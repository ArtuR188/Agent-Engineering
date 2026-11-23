# Журнал автономності (Лабораторна 3)

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
