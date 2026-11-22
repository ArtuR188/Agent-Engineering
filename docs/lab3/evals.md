# Evals у CI: еталонний набір задач і регресійна брама

- Дата: 2026-11-22 · SHA коміта базового рівня: `6483c94` · виконавець evals: власний раннер (`scripts/evals/run-evals.ts`)
- Банк: `docs/lab3/tasks.jsonl`, задач 22, `frozen_at` 2026-11-22
- Правило заморозки: після заморозки банк не правлять «по ходу» — будь-яка зміна входу або мітки вимагає нового `frozen_at`, окремого коміту з причиною та нового базового рівня.
- Кошики: `regression` 12 · `new` 5 · `edge` 5
- `k` спроб на задачу: 3 (локально) · чисте середовище: окремий `git worktree` на кожну спробу

## 1. Звідки взялися задачі
| id | bucket | джерело (прогін або траса) | еталонна мітка |
|---|---|---|---|
| t-01 | regression | `docs/lab3/tasks.jsonl#t-01` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-02 | regression | `docs/lab3/runs/t-02-1795212000000` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-03 | regression | `docs/lab3/verdicts/calibration-10.json#t-03` | `acceptance`, `touches_only_listed` |
| t-04 | regression | `docs/lab3/stop-log.jsonl#t-04` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-05 | regression | `docs/lab3/tasks.jsonl#t-05` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-06 | regression | `docs/lab3/tasks.jsonl#t-06` | `acceptance`, `touches_only_listed` |
| t-07 | regression | `docs/lab3/autonomy-log.md#lab2-cost` | `acceptance`, `touches_only_listed` |
| t-08 | regression | `docs/lab3/autonomy-log.md#lab2-models` | `acceptance`, `touches_only_listed` |
| t-09 | regression | `docs/lab3/verifier.md#schema` | `acceptance`, `touches_only_listed` |
| t-10 | regression | `docs/lab3/stop.md#breaker` | `acceptance`, `touches_only_listed` |
| t-11 | regression | `docs/lab3/stop.md#stop-ts` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-12 | regression | `docs/lab3/autonomy-log.md#lab2-rag` | `acceptance`, `touches_only_listed` |
| t-13 | new | `docs/lab3/stop.md#quota-429` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-14 | new | `docs/lab3/stop.md#half-open` | `acceptance`, `touches_only_listed` |
| t-15 | new | `docs/lab3/runs/t-02-1795212000000` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-16 | new | `docs/lab3/stop.md#step-limit` | `acceptance`, `touches_only_listed`, `tests_untouched` |
| t-17 | new | `docs/lab3/verifier.md#gates` | `acceptance`, `no_changes` |
| t-18 | edge | `docs/lab3/verdicts/calibration-10.json#edge-irrelevant` | `acceptance`, `no_changes` |
| t-19 | edge | `docs/lab3/stop.md#long-input` | `acceptance`, `no_changes` |
| t-20 | edge | `docs/lab3/verifier.md#sanitization` | `acceptance`, `no_changes`, `tests_untouched` |
| t-21 | edge | `docs/lab3/verdicts/calibration-10.json#t-03` | `acceptance`, `no_changes` |
| t-22 | edge | `docs/lab3/stop-log.jsonl#t-06` | `acceptance`, `no_changes` |

Викинуті задачі: `docs/lab3/tasks-rejected.jsonl` — 2 задачі (`rej-01`: надто широкий скоуп рефакторингу всього репо за 1 хід без детермінованого критерію; `rej-02`: вимога платної моделі Claude Opus 5 поза безкоштовним профілем Gemini API).

## 2. Оцінювачі
| оцінювач | детермінований? | що перевіряє | чому не детермінований (якщо модель) |
|---|---|---|---|
| `acceptance` | так | усі acceptance-команди завершилися з кодом 0 | — |
| `touches_only_listed` | так | `patch.diff` не змінює файлів поза переліком `files` задачі | — |
| `no_changes` | так | `patch.diff` порожній (для нерелевантного/шкідливого/read-only входу) | — |
| `tests_untouched` | так | `patch.diff` не містить правок у файлах тестів (`tests/`) | — |

Оцінювачі-моделі не додавалися, оскільки всі цільові властивості банку перевіряються детерміновано без мережі й без LLM-судді (`tests/evals/graders.test.ts`).

## 3. Числа
| кошик | задач | pass@3 | pass^3 | медіана часу | токени (вх/вих) | оцінка вартості |
|---|---:|---:|---:|---:|---:|---:|
| regression | 12 | 1.000 | 1.000 | 10.7 s | 191 734 / 19 029 | `$0.2869` |
| new | 5 | 0.800 | 0.600 | 12.3 s | 87 031 / 10 472 | `$0.1394` |
| edge | 5 | 1.000 | 1.000 | 5.7 s | 6 858 / 1 045 | `$0.0121` |

- Базовий рівень: `docs/lab3/evals-baseline.json`, записаний 2026-11-22, коміт `6483c94`.
- У кошику `new` зафіксовано різницю `pass@3 = 0.800` проти `pass^3 = 0.600` (`t-13`: `2/3`, `t-15`: `0/3` через обрізання великого файлу `src/harness/breaker.ts` попереднім лімітом `readFile` у 4000 символів).
- Поточний прогін проти базового: регресій немає на всіх 12 задачах кошика `regression`.

## 4. Брама
- Задача CI: `evals` у `.github/workflows/gates.yml` (`needs: tests`, `timeout-minutes: 20`, крок `12` хв); у переліку обов'язкових перевірок `main`: **так** (`docs/lab3/ruleset-evals.png`).
- Що саме валить збірку: `scripts/evals/gate.ts` повертає код виходу `1`, якщо будь-яка задача кошика `regression`, яка в базовому рівні мала `pass^k = 1`, зараз має менше (або якщо порушено `frozen_at`).
- У CI проганяється: кошик `regression`, `k = 1` — скорочено через добову квоту безкоштовного ключа `GEMINI_API_KEY`.
- Повні числа міряні локально 2026-11-22, `k = 3`.
- Прогін, на якому брама спрацювала (симуляція регресії `writeFile`, коміт `117ec77`): https://github.com/ArtuR188/Agent-Engineering/actions/runs/45069072666/job/137352528919?pr=4
- Наступний зелений прогін після відкату та фіксів харнесу (коміт `8555368`): https://github.com/ArtuR188/Agent-Engineering/actions/runs/45079416697/job/137384759605?pr=4

## 5. Чесні межі
- На 22 задачах одна задача = 4.55 відсоткових пунктів (а на 12 регресійних — 8.33 в.п.); змін на 1–3% цей набір статистично не бачить.
- Однакове середнє число на двох прогонах не означає однакову якість: упасти могли різні задачі, тому брама порівнює задачі поіменно.
- Набір складений із моїх відмов і сценаріїв кроків 00–03 цього репозиторію та не представляє розподіл задач узагалі.
- Детерміновані оцінювачі `graders.ts` не перевіряють `exit_status`: на задачах, де тести репозиторію вже зелені без змін, падіння агента з порожнім `patch.diff` (`agent_failed`) може дати хибний `PASS`. Це виявлено під час налагодження CI і зафіксовано як відоме обмеження.
- Оцінювачі-моделі не запускалися в CI (і не додавалися до банку), оскільки локальна Ollama недосяжна в GitHub Actions, а всі поточні перевірки покриті детермінованими оцінювачами.
- `cost_usd_estimate` — клієнтська ОЦІНКА, а не реальний рахунок: раннер рахує її через `estimateCost('cheap', ...)` за тарифом `claude-haiku-4-5`, тоді як фактичні виклики йшли через безкоштовний `gemini-3.5-flash-lite`.
