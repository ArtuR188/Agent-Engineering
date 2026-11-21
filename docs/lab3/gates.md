# Ланцюг детермінованих брам

- Workflow: .github/workflows/gates.yml
- Порядок: types → lint → tests → build → record
- Чому такий порядок: Найдешевша й найвизначеніша перевірка (`types`) стоїть першою, щоб зламані типи не оплачувалися хвилинами збірки (`build`).
- Concurrency: group `${{ github.workflow }}-${{ github.ref }}`, cancel-in-progress: true
- Артефакти: upload-artifact@v4 / download-artifact@v4 (мажори скориговано до реальних версій GitHub Actions)

## 1. Таблиця брам
| брама | що доводить | чого коштує (хв) | що пише |
|---|---|---|---|
| types | код узгоджений із власними типами: немає звернень до полів, яких немає | секунди; timeout-minutes: 5 | verdict у вихід задачі; вивід компілятора в лог прогону |
| lint | дотримані правила, які не видно з типів: мертвий код, недозволені імпорти, забуті console | секунди; timeout-minutes: 5 | verdict; перелік порушень у лог |
| tests | поведінка не змінилася там, де не мала; критерії приймання задачі справді виконані | хвилини; timeout-minutes: 10 | verdict; артефакт gate-tests із журналами прогонів харнеса |
| build | це збирається не лише в голові автора: немає відсутніх залежностей і неімпортованих модулів | хвилини; timeout-minutes: 15 | verdict; артефакт gate-build зі dist/ |
| record | не брама, свідок | секунди; timeout-minutes: 5 | gate-record.json + поле gates у run.json |

## 2. Обовʼязкові перевірки
Набір правил на main: «Require status checks to pass before merging»
Перелічені перевірки: types, lint, tests, build
«Require branches to be up to date before merging»: увімкнено (рекомендовано для уникнення злиття застарілих гілок).
Скріншот: docs/lab3/ruleset-screenshot.jpg

## 3. Навмисне падіння
Гілка: harness/red-2026-11-17 · що саме зламано: Додано некоректну типізацію (число присвоєно рядку) у src/mcp/tools.ts
Прогін: https://github.com/ArtuR188/Agent-Engineering/actions/runs/44164431629
Очікувано червона брама: types
Що показали наступні брами: skipped (а не failure)
record виконалась: так · gate-record.json: містить fail на потрібній брамі.

## 4. Звʼязок із фабрикою
Який прогін харнеса отримав ці вердикти: task_id <t-06>, artifact_dir <docs/lab3/runs/...>
