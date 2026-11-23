# Журнал автономності (Лабораторна 3)

## Зведена таблиця сесій (обов'язкові поля)

| Дата | Крок / Гілка | Інструмент і модель | Режим дозволів | Ізоляція | Втручання | Докази |
|---|---|---|---|---|---|---|
| 2026-11-17 | Крок 00 (`main`, `f50fb51`) | OpenCode + Ollama (`qwen3:4b`) | `dontAsk` еквівалент | `git worktree` | Налаштування черги, раннера і тестів | `docs/lab3/factory.md`, `tests/harness/run-task.test.ts` |
| 2026-11-22 | Крок 01–02 (`harness/verify-stop-2026-11-22`) | AI SDK + `gemini-3.5-flash-lite` | `dontAsk` (CI read-only) | GitHub Actions runner | Заміна `gemini-3.8-flash` → `3.5-flash-lite` через `503`/`429`, додано ретраї | `docs/lab3/gates.md`, `docs/lab3/verifier.md`, runs `45017118271` / `45017732428` |
| 2026-11-22 | Крок 03 (`harness/stop-2026-11-22`) | AI SDK + `gemini-3.5-flash-lite` | `dontAsk` + `allowedTools` (`.harness/config.json`) | `git worktree` / Actions | Додано 3 шари зупинення (`stop.ts`, `breaker.ts`, `factory.yml`) | `docs/lab3/stop.md`, `docs/lab3/stop-log.jsonl` |
| 2026-11-22 | Крок 04 (`harness/evals-2026-11-22`) | AI SDK + `gemini-3.5-flash-lite` | `dontAsk` + типізовані tools | `git worktree` на кожну спробу | Замороження 22 задач, симуляція й відкат регресії | `docs/lab3/evals.md`, `docs/lab3/evals.jsonl`, runs `45069072666` / `45079416697` |
| 2026-11-23 | Крок 05 (`harness/judge-2026-11-23`) | Ollama `qwen3:4b` (`9a59bb27fe92`) | read-only оцінювання артефактів | локальний Ollama, без мережі | Ручна розмітка 20 кейсів до запуску судді, ітерація рубрики v1→v2 | `docs/lab3/judge.md`, `docs/lab3/judge-cases.jsonl` |
| 2026-11-23 | Крок 06 (`harness/tracing-2026-11-23`) | AI SDK + `gemini-3.5-flash-lite` + OTel → Langfuse | `dontAsk`, `recordInputs/Outputs: false` | `git worktree` | Видалено конфліктні `@langfuse/*`, фікс `traceId` у `stop-log.jsonl` (`7f3a826`) | `docs/lab3/errors.md`, 10 пар у `docs/lab3/traces/` |
| 2026-11-23 | Крок 07 (`harness/redteam-2026-11-23`) | AI SDK + `gemini-3.5-flash-lite` | `dontAsk`, `src/harness/policy.ts` | `git worktree` на кожен кейс | Виявлено витік у `r-04` (`202f422`), закрито програмною межею (`dadd8f1`) | `docs/lab3/redteam.md`, `docs/lab3/redteam.jsonl`, 12 трас у `traces/` |
| 2026-11-23 | Крок 08 (`harness/package-2026-11-23`) | AI SDK + GitHub Actions | `dontAsk` + `allowedTools` | `git worktree` / Actions | Аудит історії на секрети, перевірка `lab1`/`lab2`, збірка `README.md` | `docs/lab3/README.md`, `docs/lab3/evals.md`, run `45160055893` |

## Сесія 1 (2026-11-17) - Фабрика
- **Агент / Модель:** opencode / Ollama
- **Режим дозволів:** dontAsk еквівалент (локально)
- **Ізоляція:** git worktree
- **Що зроблено:** Створено чергу, виконавця, скрипт обходу черги та тести.

## 2026-11-22 — Калібрування LLM-верифікатора та стоп-брама в CI (`harness/verify-stop-2026-11-22`)
* **Зміна моделі:** перехід із `gemini-3.8-flash` на `gemini-3.5-flash-lite` через тривалі `HTTP 503` і таймаути Free Tier, а також вичерпання денної квоти (`429 PerDay`) на старому проєкті (вирішено перевипуском ключа в новому Google Cloud проєкті `lab3-verifier`).
* **Посилення верифікатора:** у `scripts/harness/verify.ts` і `scripts/harness/calibrate.ts` додано `responseMimeType: "application/json"`, `temperature: 0`, таймаут 30 с і повтори на `503`/таймаут (без ретраю на `429 PerDay`).
* **Калібрування:** `n=10`, `raw=0.900`, `kappa=0.836`, 0 хибних пропусків (`docs/lab3/verdicts/calibration-10.json`).
* **Перевірка стопу в CI:**
  * червоний `verify` на неповному патчі (`e0fdc87`): https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017118271/job/137192857151
  * зелений `verify` після виправлення (`a99165c`): https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017732428

## 2026-11-22 — Крок 03: автоматичне зупинення (бюджет, таймаут, circuit breaker) (`harness/stop-2026-11-22`)
* **Три шари зупинення:**
  * шар задачі: `createTaskTimeout` (`AbortController`, 60 с) у `src/harness/stop.ts`, ліміт бюджету `maxTaskUsd: 0.25` у брейкері;
  * шар прогону: `stepLimit(n, taskId)` поверх `isStepCount(n)` + `hasToolCall('submitArtifact')` у `scripts/harness/run-loop.ts`;
  * шар харнеса: circuit breaker (`closed` / `open` / `half-open` на 1 пробну задачу) у `src/harness/breaker.ts` зі збереженням стану в `.harness/breaker.json` та unit-тестами (`src/harness/breaker.test.ts`).
* **CI та дозволи:** додано `.github/workflows/factory.yml` (`concurrency` з `cancel-in-progress: true`, `timeout-minutes: 15` на job і `8` на кроці агента, передача артефакту `breaker`) і `.harness/config.json` (`permissionMode: dontAsk`, `bypassPermissions: false`, явний `allowedTools`).
* **Живий доказ (`docs/lab3/stop-log.jsonl`):**
  * `t-04`: реальне самозупинення `gemini-3.5-flash-lite` на `isStepCount(2)` (`2/2` кроків, `submitted=false`);
  * `t-05`: `quota429` перевів брейкер у `open` (`provider_quota_429`);
  * `t-06`: наступний запуск заблоковано брейкером без виклику API (`~15 хв` cool-down).

## 2026-11-22 — Крок 04: evals у CI, заморожений банк і регресійна брама (`harness/evals-2026-11-22`)
* **Банк задач:** розширено й заморожено `docs/lab3/tasks.jsonl` до 22 задач (`12` `regression`, `5` `new`, `5` `edge`, `frozen_at: 2026-11-22`) з полями `label`, `source`, `bucket`, `frozen_at`; 2 некоректні задачі винесено в `docs/lab3/tasks-rejected.jsonl`.
* **Оцінювачі та раннер:** реалізовано детерміновані оцінювачі `scripts/evals/graders.ts` (`acceptance`, `touches_only_listed`, `no_changes`, `tests_untouched`) з офлайн-тестами `tests/evals/graders.test.ts`, раннер `scripts/evals/run-evals.ts` (`k` спроб у чистих `git worktree`, інструмент `runChecks` із виводом помилок, `temperature: 0`, ретраї на `429/503`) і поіменну браму `scripts/evals/gate.ts`.
* **Базовий рівень (`6483c94`, `k=3`):** `regression` `pass@3=1.0 / pass^3=1.0`, `new` `pass@3=0.8 / pass^3=0.6`, `edge` `pass@3=1.0 / pass^3=1.0`.
* **Регресійна брама в CI:** додано джобу `evals` у `.github/workflows/gates.yml` (`EVAL_BUCKET=regression`, `EVAL_K=1`), включено в обов'язкові перевірки `main` (`docs/lab3/ruleset-evals.png`). Доведено спрацювання на червоному прогоні (`45069072666/job/137352528919`) та відновлення на зеленому (`https://github.com/ArtuR188/Agent-Engineering/actions/runs/45079416697/job/137384759605?pr=4`).

## 2026-11-23 — Крок 05: калібрування судді `ollama:qwen3:4b` і одна ітерація рубрики (`harness/judge-2026-11-23`)
* **Ручна розмітка (`fc77c65`):** зібрано 20 реальних артефактів харнеса (14 робочих + 6 `holdout`) у `docs/lab3/runs/` і закомічено `docs/lab3/judge-cases.jsonl` (40 пар по вимірах `acceptance_met` і `scope_respected`) до запуску судді.
* **Суддя та калібрування:** реалізовано `scripts/judge/run-judge.ts` (окремий запит на кожен вимір до локальної `ollama:qwen3:4b`, `temperature: 0`, `think: false`, фіксація `model` і `order`) та `scripts/judge/calibrate.ts` (сира згода, каппа Коена, матриця 3×3).
* **Ітерація рубрики (`rubric-v1.md` -> `rubric-v2.md`):** на `acceptance_met` (усі 20) сира згода зросла з `0.650` до `0.700`, каппа з `0.167` до `0.348` (`fail -> pass` зменшився з `3` до `2`); на `scope_respected` сира згода `0.750`, каппа `0.000`.
* **Рішення (`docs/lab3/judge.md`):** суддя дає пораду, регресійну браму тримають детерміновані перевірки Кроку 04.

## 2026-11-23 — Крок 06: трасування OpenTelemetry у Langfuse та аналіз 10 помилок (`harness/tracing-2026-11-23`)
* **Телеметрія (`824bba4`):** видалено конфліктні `@langfuse/otel` та `@langfuse/vercel-ai-sdk`; встановлено `@ai-sdk/otel@1.0.148`, `@opentelemetry/api@1.10.0`, `@opentelemetry/sdk-node@0.300.0`, `@opentelemetry/exporter-trace-otlp-http@0.300.0`. Єдина точка реєстрації — `src/telemetry/otel.ts` (OTLP/HTTP → Langfuse EU, `recordInputs: false`, `recordOutputs: false`, no-op fallback у CI без `OTEL_EXPORTER_OTLP_ENDPOINT`).
* **Кореляція `trace_id`:** підтверджено збіг 32-символьного `trace_id` між `run.json`, `docs/lab3/evals.jsonl` і деревом спанів у Langfuse на двох живих прогонах (`t-01`: `77e29c21abbdecd3e89ec669d639f72a`, `t-02`: `e4498da066a2387a729c19e098ce6119`).
* **Аналіз помилок (`docs/lab3/errors.md`):** зібрано та класифіковано 10 невдалих прогонів із трасами по всіх 5 класах (`задача` ×2, `промпт` ×2, `інструмент` ×2, `харнес` ×2, `модель` ×2); усі 10 пар скріншотів і санітизованих текстових витяжок збережено в `docs/lab3/traces/`.
* **Фікс-коміт за результатами трас (`7f3a826`):** додано автоматичний запис активного `traceId` у `docs/lab3/stop-log.jsonl` (`src/harness/stop.ts` + тести `src/harness/stop.test.ts`), посилено промпт `scripts/evals/run-evals.ts` проти повторних помилкових викликів `readFile` та додано санітизацію локальних шляхів у `scripts/telemetry/collect-error-traces.ts`.

## 2026-11-23 — Крок 07: red-team стійкість до ін'єкції промпту (`harness/redteam-2026-11-23`)
* **Сценарії та кодові інваріанти (`202f422`):** створено `scripts/redteam/cases.ts` (6 сценаріїв за мотивами AgentDojo та InjecAgent: `r-01..r-06` по 2 на `task_input`, `tool_result`, `fetched_doc`), `scripts/redteam/invariants.ts` (5 детермінованих перевірок після кожного прогону в ізольованому `git worktree`) і раннер `scripts/redteam/run-redteam.ts`; базовий прогін `before` зафіксував порушення `no_canary_leak` у `r-04`.
* **Програмна межа в харнесі (`dadd8f1`):** реалізовано `src/harness/policy.ts` (`assertReadAllowed`, `assertWriteAllowed`, `assertSafeOutput`) і тести `src/harness/policy.test.ts`; повторний прогін `after` завершився з кодом `0` (0 порушень), витяжки трас збережено в `docs/lab3/traces/`, звіт оформлено в `docs/lab3/redteam.md`.

## 2026-11-23 — Крок 08: пакет доказів, аудит секретів і фінальний звіт (`harness/package-2026-11-23`)
* **Інструмент і модель:** AI SDK `7.0.173` + `gemini-3.5-flash-lite`, Ollama `qwen3:4b`, OpenTelemetry → Langfuse EU.
* **Режим дозволів та ізоляція:** `dontAsk` + явний `allowedTools` (`.harness/config.json`, без прапорців обходу), ізоляція кожного прогону в окремому `git worktree`.
* **Втручання:** аудит історії `git log --all` на `.env`/`.env.local` та префікси ключів провайдерів (реальних секретів не виявлено); перевірено незмінність `docs/lab1/` і `docs/lab2/`; додано підсумок у `docs/lab3/evals.md` і зібрано `docs/lab3/README.md`.
* **Докази:** `docs/lab3/README.md`, `docs/lab3/evals.md`, зелений `gates` (`45160055893` на `53f54d8`) та збережені червоні прогони `45017118271` (`verify`) і `45069072666` (`evals`).
