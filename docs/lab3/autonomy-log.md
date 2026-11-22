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
