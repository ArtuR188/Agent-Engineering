# Крок 06 — Трасування виконання і аналіз помилок

## 1. Налаштування телеметрії та перевірені експорти

* **Бекенд:** Langfuse Cloud EU (`https://cloud.langfuse.com/api/public/otel`, проєкт `lab1-agent`, тариф Hobby, заголовок `x-langfuse-ingestion-version=4`). Читання спанів для текстових витяжок переведено на `GET /api/public/v2/observations?fields=core,basic,usage,metadata`, оскільки Langfuse v3 `/api/public/traces/{id}` вимкнено 2026-11-19.
* **Точка реєстрації:** `src/telemetry/otel.ts` (`initTelemetry()` викликається один раз на старті процесу в `instrumentation.node.ts`, `scripts/harness/run-queue.ts`, `scripts/harness/run-loop.ts`, `scripts/evals/run-evals.ts` і `scripts/telemetry/collect-error-traces.ts`; `shutdownTelemetry()` гарантує відправку спанів перед виходом CLI-процесу). Якщо `OTEL_EXPORTER_OTLP_ENDPOINT` порожній (наприклад, у CI), використовується no-op процесор: `trace_id` усе одно генерується, але мережеві запити не виконуються.
* **Перевірені версії та runtime-експорти в `node_modules`:**
  * `@ai-sdk/otel@1.0.148` — `OpenTelemetry`, `LegacyOpenTelemetry`
  * `@opentelemetry/api@1.10.0` — `trace` (та ін. базові API)
  * `@opentelemetry/sdk-node@0.300.0` — `NodeSDK`, `startNodeSDK`
  * `@opentelemetry/exporter-trace-otlp-http@0.300.0` — `OTLPTraceExporter`
* **Конфлікт залежностей (вирішено в `824bba4`):** видалено застарілі `@langfuse/otel@^6.1.1` і `@langfuse/vercel-ai-sdk@^6.1.1` з лабораторної 1, які вимагали `@opentelemetry/api < 1.10.0` та `exporter < 0.300.0`; `app/api/agent/route.ts` і `instrumentation.node.ts` переведено на `src/telemetry/otel.ts`.
* **Захист даних:** у всіх точках виклику AI SDK (`app/api/agent/route.ts`, `scripts/harness/run-loop.ts`, `scripts/evals/run-evals.ts`, `scripts/telemetry/collect-error-traces.ts`) передано `telemetry: { recordInputs: false, recordOutputs: false }` (на скріншотах Langfuse у вкладці `Preview` зафіксовано `Input: undefined`, `Output: undefined`). У публічних текстових витяжках `docs/lab3/traces/*.txt` виключено `resourceAttributes.*` (ім'я хоста, користувача, шляхи ОС) та санітизовано локальні шляхи з `stderr`.

## 2. Зв'язок `run.json` ↔ `docs/lab3/evals.jsonl` ↔ Langfuse (`trace_id`)

| Задача | Артефакт `run.json` | Рядок у `docs/lab3/evals.jsonl` | `trace_id` (32 hex) | Результат | Токени (in / out) | Час |
|---|---|---|---|---|---|---|
| `t-01` | `docs/lab3/runs/t-01-1795425173835/run.json` | `sha: 824bba4`, `attempt: 1` | `77e29c21abbdecd3e89ec669d639f72a` | `ok` / `pass: true` | `2791 / 70` | `10.7s` |
| `t-02` | `docs/lab3/runs/t-02-1795425708101/run.json` | `sha: 824bba4`, `attempt: 1` | `e4498da066a2387a729c19e098ce6119` | `ok` / `pass: true` | `5819 / 992` | `17.9s` |

В обох прогонах `trace_id` збігається посимвольно між `run.json`, `docs/lab3/evals.jsonl` та кореневим спаном `task <id>` у Langfuse, під яким розгортається дерево `invoke_agent gemini-3.5-flash-lite` → кроки `chat` → `execute_tool` (`readFile`, `runChecks`, `submitArtifact`).

## 3. Класифікація 10 невдалих прогонів за трасами

Оскільки заморожений банк `regression`/`edge` проходив на 100%, для збору повної вибірки по всіх п'яти класах без псування регресійної брами `docs/lab3/evals.jsonl` виконано контрольовану серію прогонів через `scripts/telemetry/collect-error-traces.ts` на тій самій моделі `gemini-3.5-flash-lite` і тій самій телеметрії `src/telemetry/otel.ts` (11 запусків → 10 невдалих прогонів у вибірці).

| # | Задача (спроба) | Клас помилки | `trace_id` | Артефакти (скрін + витяжка) | Що видно у спанах | Токени (in/out), час, оцінка вартості | Конкретний діагноз |
|---|---|---|---|---|---|---|---|
| 1 | `err-task-01` (#1) | **задача** | `b3ec39aa55874633a0f8448d8b4e10fc` | [png](traces/2026-11-23-task-b3ec39aa55874633a0f8448d8b4e10fc.png), [txt](traces/2026-11-23-task-b3ec39aa55874633a0f8448d8b4e10fc.txt) | 11 obs, 3 `chat`, `readFile` → `runChecks` → `submitArtifact`, `finish=["tool-calls"]`, 0 `ERROR` | `870 / 57`, `2.8s`, `$0.001155` (LF `$0.000403`) | Зламаний acceptance (`Missing script: "nonexistent-acceptance-check"`): агент коректно викликав інструменти, але зовнішня команда завідомо нездійсненна. |
| 2 | `err-task-01` (#2) | **задача** | `0ea4e17bf140cc35b4306097fa022f7e` | [png](traces/2026-11-23-task-0ea4e17bf140cc35b4306097fa022f7e.png), [txt](traces/2026-11-23-task-0ea4e17bf140cc35b4306097fa022f7e.txt) | 9 obs, 2 `chat`, `readFile` → `runChecks` → `submitArtifact`, `finish=["tool-calls"]`, 0 `ERROR` | `609 / 58`, `2.3s`, `$0.000899` (LF `$0.000328`) | Повторна спроба `k=2` падає на тій самій команді acceptance — детермінована ознака дефекту задачі, а не випадкового збою моделі. |
| 3 | `err-prompt-01` (#1) | **промпт** | `7aaaefabfbcc81e2b6e2946fbe442de6` | [png](traces/2026-11-23-prompt-7aaaefabfbcc81e2b6e2946fbe442de6.png), [txt](traces/2026-11-23-prompt-7aaaefabfbcc81e2b6e2946fbe442de6.txt) | 4 obs, 1 `chat`, **0 `execute_tool`**, `finish=["stop"]` | `224 / 99`, `0.9s`, `$0.000719` (LF `$0.000315`) | Промпт не вимагає запису файлу `circuit-note.md`: модель обмежилася текстовою відповіддю, `patch_bytes=0`, acceptance впав. |
| 4 | `err-prompt-02` (#1) | **промпт** | `0a751a932e983a0d42252acd2a57d48d` | [png](traces/2026-11-23-prompt-0a751a932e983a0d42252acd2a57d48d.png), [txt](traces/2026-11-23-prompt-0a751a932e983a0d42252acd2a57d48d.txt) | 4 obs, 1 `chat`, **0 `execute_tool`**, `finish=["stop"]` | `226 / 133`, `1.1s`, `$0.000891` (LF `$0.000400`) | Аналогічний розрив між текстом промпта та очікуваним файловим артефактом `buckets-note.md`: жодного виклику `writeFile`. |
| 5 | `err-tool-01` (#1) | **інструмент** | `0dde34a3a1cf21a4ac8564012572c050` | [png](traces/2026-11-23-tool-0dde34a3a1cf21a4ac8564012572c050.png), [txt](traces/2026-11-23-tool-0dde34a3a1cf21a4ac8564012572c050.txt) | 8 obs, 2 `chat`, `readFile:ERROR` → `submitArtifact`, `finish=["tool-calls"]` | `497 / 84`, `1.7s`, `$0.000917` (LF `$0.000359`) | Спанова помилка в `execute_tool` (`readFile`, `level=ERROR`): sandbox guard заблокував читання `.env.local`, файл `env-copy.txt` не створено. |
| 6 | `err-tool-02` (#1) | **інструмент** | `2d03e6acf43f46276ef6216f02b3d530` | [png](traces/2026-11-23-tool-2d03e6acf43f46276ef6216f02b3d530.png), [txt](traces/2026-11-23-tool-2d03e6acf43f46276ef6216f02b3d530.txt) | 11 obs, 3 `chat`, `readFile:ERROR` → `readFile:ERROR` → `submitArtifact` | `861 / 89`, `2.6s`, `$0.001306` (LF `$0.000481`) | `readFile` кинув `ENOENT` на `missing/config.json`; агент витратив зайвий крок і повторно викликав той самий неіснуючий шлях, отримавши другий `ERROR`. |
| 7 | `err-harness-01` (#1) | **харнес** | `d8d0312c60ec87635376a7d6f6e04f8a` | [png](traces/2026-11-23-harness-d8d0312c60ec87635376a7d6f6e04f8a.png), [txt](traces/2026-11-23-harness-d8d0312c60ec87635376a7d6f6e04f8a.txt) | 8 obs, 2 `chat`, `readFile` ×2, без `submitArtifact`, `exit_status=step_limit` | `560 / 32`, `3.4s`, `$0.000720` (LF `$0.000248`) | Обмеження харнеса `stepLimit(2)` зупинило цикл до завершення 4-крокової задачі; зафіксовано рядок у `docs/lab3/stop-log.jsonl` (`limit: isStepCount`), але без `traceId`. |
| 8 | `err-harness-02` (#1) | **харнес** | `12f59e6f04c93c40fbc21ddb0ec97fe3` | [png](traces/2026-11-23-harness-12f59e6f04c93c40fbc21ddb0ec97fe3.png), [txt](traces/2026-11-23-harness-12f59e6f04c93c40fbc21ddb0ec97fe3.txt) | 4 obs, 1 `chat`, `ERROR` на `invoke_agent`/`step 1`/`chat` (`AI SDK operation failed`) | `null / null`, `1.4s`, `$0` | `createTaskTimeout(1400ms)` перервав запит через `AbortController` (`exit_status=timeout`); у `stop-log.jsonl` записано `taskTimeout`, але без `traceId`. |
| 9 | `err-model-02` (#1) | **модель** | `b99c179b23261f508298f230fe0ae2bf` | [png](traces/2026-11-23-model-b99c179b23261f508298f230fe0ae2bf.png), [txt](traces/2026-11-23-model-b99c179b23261f508298f230fe0ae2bf.txt) | 11 obs, 3 `chat`, `readFile` → `writeFile` → `runChecks`, 0 `ERROR` | `1882 / 945`, `4.3s`, `$0.006607` (LF `$0.002927`) | Інструменти та задача справні, але модель неправильно реалізувала сортування SemVer 2.0.0: поставила `1.0.0+build.1` перед `1.0.0` замість збереження відносного порядку. |
| 10 | `err-model-03` (#1) | **модель** | `563e2771a9cf382ff61b8a136f6d9261` | [png](traces/2026-11-23-model-563e2771a9cf382ff61b8a136f6d9261.png), [txt](traces/2026-11-23-model-563e2771a9cf382ff61b8a136f6d9261.txt) | 11 obs, 3 `chat`, `readFile` → `writeFile` → `runChecks`, 0 `ERROR` | `1565 / 670`, `3.5s`, `$0.004915` (LF `$0.002144`) | Інструменти справні, але парсер RFC 4180 загубив екрановані лапки всередині поля (`b,c` замість `b,\"c\"`), і модель вичерпала 3 кроки без фіксу. |

## 4. Розподіл класів і спостереження з телеметрії

| Клас помилки | Кількість | Частка | Середній час | Середні токени (in / out) | Ключовий сигнал у трасі |
|---|---:|---:|---:|---:|---|
| **задача** | 2 | 20% | `2.55s` | `740 / 58` | Усі спроби `k` падають на тій самій команді acceptance при чистих спанах `execute_tool`. |
| **промпт** | 2 | 20% | `1.00s` | `225 / 116` | Лише 1 спан `chat`, `finish_reasons=["stop"]`, нуль спанів `execute_tool`. |
| **інструмент** | 2 | 20% | `2.15s` | `679 / 87` | Спан `execute_tool` має `level=ERROR`; при `ENOENT` модель робить зайвий повторний виклик. |
| **харнес** | 2 | 20% | `2.40s` | `560 / 32` (для `step_limit`) | Обрив без `submitArtifact` або `level=ERROR` на `invoke_agent`/`chat` + запис у `stop-log.jsonl`. |
| **модель** | 2 | 20% | `3.90s` | `1724 / 808` | Найвища витрата токенів (у 2.5–7× більше за інші класи), чисті спани `writeFile`/`runChecks`, логічний баг у патчі. |

**Додаткові знахідки з живих трас:**
1. **Розрив кореляції у `stop-log.jsonl`:** на прогонах `err-harness-01` та `err-harness-02` зупинка фіксувалась у `docs/lab3/stop-log.jsonl`, але без `traceId`.
2. **Витік локальних шляхів у витяжках:** перша версія екстрактора пропустила фрагмент абсолютного локального шляху ОС (`<local-path>`) із `npm ERR!` у двох файлах `err-task-01` — виправлено санітизацією.
3. **Завищена локальна оцінка вартості:** `estimateCost('cheap', ...)` у `src/models.ts` дає у 2.2–2.8× більшу суму, ніж фактичний розрахунок Langfuse Standard tier (наприклад, `$0.006607` проти `$0.002927` на `err-model-02`) — це консервативний запас для бюджету, але його варто калібрувати окремо в майбутньому.

## 5. План виправлень і виконаний фікс-коміт

| Клас | Що виправляти | Статус | Коміт / Артефакт |
|---|---|---|---|
| **харнес** | Автоматично записувати активний `traceId` (включно з прив'язкою перед `setTimeout` / промісами) у кожен рядок `docs/lab3/stop-log.jsonl` через `src/harness/stop.ts` + покрити unit-тестами. | **Виконано** | `7f3a826` (`src/harness/stop.ts`, `src/harness/stop.test.ts`) |
| **інструмент + промпт** | Додати в промпт `scripts/evals/run-evals.ts` явну заборону повторного виклику `readFile` на помилковому/забороненому шляху та вимогу викликати `writeFile` для задач із непустим `task.files`; санітизувати локальні шляхи в `scripts/telemetry/collect-error-traces.ts`. | **Виконано** | `7f3a826` (`scripts/evals/run-evals.ts`, `scripts/telemetry/collect-error-traces.ts`) |
| **задача** | Перед додаванням нової задачі в `docs/lab3/tasks.jsonl` проганяти dry-run її `acceptance`-команди (невалідні задачі відсіювати в `tasks-rejected.jsonl`). | Зафіксовано як правило банку | `docs/lab3/tasks-rejected.jsonl` |
| **модель** | Не змінювати `temperature` вище `0` у проді (у `run-evals.ts` вже `temperature: 0`) і залишати мінімум `maxSteps >= 6`, щоб модель мала кроки на виправлення після першого червоного `runChecks`. | Перевірено в `run-evals.ts` | `scripts/evals/run-evals.ts` |

Усі локальні перевірки після фікс-коміту `7f3a826` (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npx tsx scripts/evals/gate.ts`) пройшли без помилок.
