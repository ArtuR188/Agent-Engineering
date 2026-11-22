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
