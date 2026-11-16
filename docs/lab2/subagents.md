# Субагенти — розподіл роботи за специфікацією

Інструмент і версія: OpenCode CLI 1.19.3 + цикл runAgentLoop (src/agent/agent-loop.ts) · Модель: gemini-3.5-flash-lite · Дата: 2026-11-16

## Розподіл
| Субагент | Пункти специфікації | Інструменти | Модель | Файл конфігурації |
|---|---|---|---|---|
| spec-auditor | Критерії приймання A1–A6 у docs/lab2/spec.md | Read, Grep, Glob (read-only: list_files, read_file) | inherit (gemini-3.5-flash-lite) | .claude/agents/spec-auditor.md |
| explorer | Обсяг роботи v1 (розділ 5 spec.md), точки входу, скрипти перевірки | Read, Grep, Glob (read-only: list_files, read_file) | inherit (gemini-3.5-flash-lite) | .claude/agents/explorer.md |

## Що субагент бачить
- Власний системний промпт (тіло файлу .claude/agents/spec-auditor.md або .claude/agents/explorer.md).
- Формулювання задачі, передане при запуску (diff 9415544..61ac0ef для spec-auditor; запит на карту репозиторію для explorer).
- Кореневі інструкції репозиторію (AGENTS.md) і лише інструменти читання (без write/edit/bash).

## Чого субагент НЕ бачив (доказ ізоляції)
- Питання: «Який саме файл ми щойно правили в попередньому повідомленні нашої розмови і яку помилку рядка 38 ми там обговорювали?»
- Відповідь субагента дослівно: «Оскільки я є незалежним аудитором специфікації проєкту «ZeroGravity Gym», у мене немає контексту попередніх розмов чи сесій чату (я не маю пам'яті попередніх повідомлень у цій системі). Крім того, згідно з інструкцією, якщо мені потрібно перевірити критерії приймання, я маю спочатку прочитати docs/lab2/spec.md та надані зміни (diff). В оновленому запиті ви не надали ні файлу специфікації, ні diff/змін у репозиторії.»
- Висновок: історії батьківської розмови (зокрема виправлення рядка 38 у src/agent/adapters.ts) у контексті субагента немає.

## Звіт spec-auditor по diff 9415544..61ac0ef
A1 | unknown — у наданому diff немає результатів виконання npm test / typecheck / lint / build
A2 | pass — docs/lab2/golden/queries.jsonl додано (20 запитів) та є валідатор scripts/validate-golden.ts і tests/validate-golden.test.ts
A3 | unknown — у наданому diff немає перевірки історії git log щодо спеки та логів агентів
A4 | unknown — у наданому diff немає файлу docs/lab2/verifier.md із записами верифікатора
A5 | unknown — у наданому diff немає результатів прогону run-eval.ts та eval-report.md
A6 | unknown — у наданому diff немає кодів/тестів MCP-сервера та документації в mcp-integration.md

Примітка щодо explorer та вбудованого Explore: власний explorer прив'язаний до структури пакетів доказів docs/lab1/, docs/lab2/ та скриптів перевірки в scripts/, тоді як вбудований Explore робить загальний обхід коду без специфіки курсу.

## Делегування в журналі
- https://github.com/ArtuR188/Agent-Engineering/blob/main/.agent-log/opencode.jsonl#L94
- https://github.com/ArtuR188/Agent-Engineering/blob/main/.agent-log/opencode.jsonl#L95
- https://github.com/ArtuR188/Agent-Engineering/blob/main/.agent-log/agent-loop.jsonl#L19

## Як зводяться результати
Звіти субагентів зводяться головним процесом в однопотоковому режимі: explorer викликається перед зміною для складання карти файлів, spec-auditor — після зміни по git diff; пункти зі статусом fail блокують злиття, а unknown закриваються запуском тестів або наступних кроків.

## Залежності субагентів (Крок 07)
Кожен субагент вимагає ізольованого робочого дерева або доступу лише на читання. Детальний граф залежностей: [Граф у budget.md](./budget.md).
- **SearchSubagent**: від чого залежить / чий результат потрібен на вході: Готовий векторний індекс `data/index.json`.
- **VerifierSubagent**: від чого залежить / чий результат потрібен на вході: Специфікація `spec.md` та згенерований звіт.
