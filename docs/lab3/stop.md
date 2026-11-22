# Автоматичне зупинення: бюджет, таймаут, circuit breaker

## Три шари
| Шар | Що обмежує | Чим реалізовано | Значення | Де в коді |
|---|---|---|---|---|
| задача | ходи (CLI) | `maxTurns` / `--max-turns` (Claude Code, платний) / `model.maxSessionTurns` (Gemini CLI) | недоступно на нашому прямому API-шляху (описано нижче) | — |
| задача | гроші | `maxBudgetUsd` / `--max-budget-usd` (клієнтська ОЦІНКА, платний Claude Code) | поріг у брейкері `$0.25` / задача (`maxTaskUsd`) | `src/harness/breaker.ts` |
| задача | токени | `taskBudget: { total }` (АЛЬФА, Anthropic API) | недоступно на безкоштовному Gemini API | — |
| задача | час (безкоштовний шлях) | `createTaskTimeout` (`AbortController` + таймер) | `60000 ms` (60 с) | `src/harness/stop.ts`, `scripts/harness/run-loop.ts` |
| прогін | кроки циклу AI SDK | `stopWhen: [stepLimit(N, taskId), hasToolCall('submitArtifact')]` поверх `isStepCount(N)` | типово `6` кроків (для доказу зупинення — `2`) | `src/harness/stop.ts`, `scripts/harness/run-loop.ts` |
| CI | час і паралельність | `timeout-minutes` на задачі й кроці + `concurrency` (`cancel-in-progress: true`) | job: `15` хв, step агента: `8` хв | `.github/workflows/factory.yml` |
| харнес | повтор аварій і квота | circuit breaker (`closed` / `open` / `half-open`) | див. нижче | `src/harness/breaker.ts`, `.harness/breaker.json` |

Типові значення, які діяли б без мене: `ToolLoopAgent` — `isStepCount(20)`; голі `generateText`/`streamText` — `isStepCount(1)`; `WorkflowAgent` — без ліміту кроків.

## Дозволи та ізоляція
* **Режим дозволів:** `dontAsk`, `bypassPermissions: false` (`.harness/config.json`, перевіряється при старті `scripts/harness/run-loop.ts`).
* **Явний перелік дозволених інструментів:** `readFile`, `listFiles`, `submitArtifact` (із забороною виходу за межі репозиторію та доступу до `.env`).
* **Ізоляція:** `git worktree` у черзі задач (`scripts/harness/run-queue.ts`); у циклі `run-loop.ts` доступ обмежено лише переліченими read-only інструментами.

## Circuit breaker
* **Умови спрацювання (мої):**
  * `N` однакових/послідовних відмов підряд: `3` (`consecutiveFailThreshold: 3`);
  * немає прогресу `M` задач: `3` (`noProgressLimit: 3`);
  * вартість задачі вище за бюджет: `> $0.25` (`maxTaskUsd: 0.25`);
  * частка червоних брам вище за: `> 0.60` у вікні останніх `5` задач (`redGateRatioThreshold: 0.6`, `redGateWindow: 5`);
  * відмова провайдера за квотою (`HTTP 429`): **так** — відкриває брейкер негайно (`provider_quota_429`), бо повторні виклики при вичерпаній квоті марно спалюють `timeout-minutes`.
* **Перепочинок (cool-down):** базовий `15` хв (`baseCooldownMin: 15`), при провалі пробної задачі подвоюється до максимуму `120` хв (`maxCooldownMin: 120`).
* **Half-open:** рівно одна пробна задача (`probeInFlight: true` блокує паралельні); зелена → `closed` (скидання лічильників і cool-down до 15 хв), червона → негайно `open` із подвоєним перепочинком.
* **Де живе стан між прогонами:** локально у `.harness/breaker.json`, у CI передається через артефакт `breaker` (`actions/download-artifact@v8` / `actions/upload-artifact@v7` у `.github/workflows/factory.yml`).

## Походження патерну — чесно
Fowler, «CircuitBreaker» (06.03.2014): `closed` / `open` / `half-open`, патерн для викликів віддалених служб (популяризований у книзі Michael Nygard «Release It!»). Первинного вендорського джерела, що застосовує брейкер саме до агентних циклів, немає. Це моє інженерне рішення за аналогією, а не усталена практика.

## Прогін, який зупинився сам
### 1. Самозупинення за лімітом кроків (`isStepCount`)
* **Прогін:** локальний запуск `npm run harness -- --task t-04 --max-steps 2` (2026-11-22T12:03:33.199Z), модель `gemini-3.5-flash-lite`.
* **Який ліміт спрацював:** `isStepCount(2)` через обгортку `stepLimit(2, 't-04')` у `src/harness/stop.ts`.
* **На чому саме:** задача `t-04` вимагала 5 кроків (прочитати 4 файли + викликати `submitArtifact`); цикл зупинився на кроці `2/2` до виклику `submitArtifact`.
* **Що харнес зробив далі:** записав рядок у `docs/lab3/stop-log.jsonl`, зафіксував невдачу в `.harness/breaker.json` (`fails: 1`, стан залишився `closed`), завершив процес із кодом `1`.
* **Чи це те, що я планував:** так — підтверджено, що `stopWhen` реально перериває цикл моделі, а не доходить до природного завершення.
* **Рядок журналу:** `docs/lab3/stop-log.jsonl` (рядок 1, `2026-11-22T12:03:33.199Z`).

### 2. Спрацювання брейкера на `HTTP 429` і наступний прогін після нього
* **Прогін з квотою (`t-05`):** `npm run harness -- --task t-05 --simulate-429` (`2026-11-22T12:03:34.185Z`) — спрацювала умова `quota429`, брейкер перейшов у `open` (`trip: "provider_quota_429"`, `cooldownMin: 15`, запис у `.harness/breaker.json`, exit code `3`).
* **Наступний прогін (`t-06`):** `npm run harness -- --task t-06` (`2026-11-22T12:03:35.122Z`) — `mayRun()` повернув `allow: false` (`open (provider_quota_429): залишилось ~15 хв перепочинку`), задачу пропущено без виклику API, записано рядок 3 у `docs/lab3/stop-log.jsonl` (exit code `2`).

## Чого я НЕ контролюю
* `maxBudgetUsd` — клієнтська оцінка вартості, вона може перевищити ліміт перед зупинкою; потрібен запас щонайменше 15–20%.
* Витрати, відновлені з продовженої сесії (`--resume`), у `maxBudgetUsd` не входять — підсумок по задачі потрібно складати окремо.
* Витрати субагентів у `maxBudgetUsd` входять (нові не стартують із `Budget limit reached`, фонові зупиняються).
* `taskBudget: { total }` перебуває в статусі альфа і недоступний на безкоштовному Gemini API.
* **Чесно про мій безкоштовний шлях (`Gemini API Free Tier` + `AI SDK`):** вендорських лімітів `maxTurns`, `maxBudgetUsd` і `taskBudget` у мене немає (у Gemini CLI відомий лише `model.maxSessionTurns` у `run-gemini-cli@v0`). Тому реальні зупинювачі в цьому репозиторії — власний `stopWhen` (`isStepCount`), `AbortController`-таймаут на задачу, `timeout-minutes` + `concurrency` у GitHub Actions та circuit breaker із реакцією на `HTTP 429`.