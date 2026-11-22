# Lab 3 — LLM-верифікатор і стоп-брама в CI

## 1. Конфігурація верифікатора
* **Модель:** `gemini-3.5-flash-lite` (перехід із `gemini-3.8-flash` через тривалі `HTTP 503` та таймаути на стороні API).
* **Скрипти:** `scripts/harness/verify.ts` (CI-брама), `scripts/harness/calibrate.ts` (калібрування на 10 кейсах), `scripts/kappa.ts` (розрахунок $\kappa$ Коена).
* **Надійність і безпека:**
  * примусовий JSON-режим (`responseMimeType: "application/json"`, `temperature: 0`);
  * таймаут 30 с (`AbortSignal.timeout(30000)`) та експоненційні повтори на `503`/мережеві збої без марних повторів на денний ліміт `429 PerDay`;
  * санітизація `patch.diff` перед відправкою в LLM (видалення `.env`-файлів і маскування секретів/ключів);
  * строга валідація відповіді через Zod (`src/verify/schema.ts`): `evidence` обов'язкове для `pass`/`fail` і порожнє для `unknown`.
* **Правило блокування:** брама `verify` повертає `exit code 1`, якщо хоча б один критерій має вердикт `fail` або `unknown`.

---

## 2. Калібрування (n = 10)
Артефакт: `docs/lab3/verdicts/calibration-10.json`

* **Raw agreement:** `0.900` (9 / 10)
* **Expected agreement:** `0.390`
* **Cohen's kappa ($\kappa$):** `0.836`

### Матриця невідповідностей (рядки — ручна розмітка, стовпці — суддя)
| Mine \ Judge | `pass` | `fail` | `unknown` |
| --- | :---: | :---: | :---: |
| **`pass`** | 5 | 0 | 0 |
| **`fail`** | 0 | 3 | 0 |
| **`unknown`** | 0 | 1 | 1 |

### Розбір розбіжностей та методологічна примітка
* **Хибні пропуски (`fail/unknown -> pass`):** `0` — жодного небезпечного пропуску в CI.
* **Єдина розбіжність (кейс #6, `t-03`):** ручна оцінка `unknown`, суддя поставив `fail` на обрізаному diff без реалізації тесту. Для CI-брами це безпечне перестрахування (обидва вердикти блокують мердж).
* **Методологічна примітка:** кейси #1–#7 виконано до увімкнення `responseMimeType: "application/json"`; після помилки парсингу неекранованого рядка на кейсі #8 увімкнено JSON-режим і `temperature: 0`, після чого кейси #8–#10 пройшли стабільно.

---

## 3. Доказ роботи стоп-брами в CI (`gemini-3.5-flash-lite`)

### Червоний прогін (блокування неповного патчу)
* **Коміт:** `e0fdc87` (гілка `harness/verify-stop-2026-11-22`)
* **CI Run:** https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017118271/job/137192857151
* **Результат джоб:** `types`, `lint`, `tests`, `build`, `record` — **green**; `verify` — **red** (`exit code 1`).
* **Вердикт судді:**
~~~json
[
  {
    "id": "JSDoc-comment-added-to-fetchChunk",
    "verdict": "fail",
    "reason": "У git diff замість JSDoc коментаря до функції fetchChunk додано лише коментар 'TODO: check later', а сама функція та її JSDoc відсутні.",
    "evidence": "src/mcp/tools.ts: +// TODO: check later"
  }
]
~~~

### Зелений прогін (пропуск після виправлення патчу)
* **Коміт:** `a99165c` (гілка `harness/verify-stop-2026-11-22`)
* **CI Run:** https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017732428
* **Результат джоб:** усі 6 джоб (`types`, `lint`, `tests`, `build`, `record`, `verify`) — **green** (`Success`, 3 артефакти).