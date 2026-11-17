# Фабрика задач

- Дата: 2026-11-17 · репозиторій: https://github.com/ArtuR188/Agent-Engineering
- Шлях агента: opencode + Ollama (локально)
- Чому саме цей: Безкоштовно, повністю ізольовано на локальній машині.
- Режим дозволів: Базовий opencode запуск `-p`.
- Ізоляція: git worktree, команда дослівно: `git worktree add -b <branch> <tree> main`

## 1. Форма задачі
Поля: id, input (промпт), acceptance (масив команд перевірки), budget, files.
Черга: docs/lab3/tasks.jsonl (6 задач).

## 2. Виклик агента
`npx opencode -p "<input>"`

## 3. Де лежать артефакти
Сирі прогони у `runs/<id>-<timestamp>/`. Відібрані для репозиторію — `docs/lab3/runs/`.

## 4. Журнал прогону
Поля записуються виконавцем. Оскільки модель локальна, `session_id` та токени поки `null`, `cost_usd_estimate` = 0.

## 5. Як перезапустити одну задачу
`npx tsx scripts/harness/run-queue.ts docs/lab3/tasks.jsonl --id t-01`

## 6. Що перевірено без мережі
`tests/harness/run-task.test.ts` перевіряє запис журналів, падіння та ліміти без реального агента.
