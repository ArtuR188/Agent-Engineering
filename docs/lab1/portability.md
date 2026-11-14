# Переносність між інструментами — Лабораторна 1

Значення: працює без змін / потрібна адаптація (яка) / не підтримується (чим замінили).

| Артефакт | OpenCode | GitHub Copilot CLI |
|---|---|---|
| AGENTS.md | працює без змін (читає кореневий `AGENTS.md` автоматично) | працює без змін (читає кореневий `AGENTS.md` автоматично) |
| Режим плану | потрібна адаптація (за замовчуванням `plan` забороняє `edit`, але дозволяє `bash`; додано `"permission": { "edit": "deny", "bash": "deny", "task": "deny" }` в `opencode.json`, запуск через `--agent plan`) | працює без змін (префікс `/plan` у промпті обмежує сесію лише читанням `view`/`glob` навіть з прапорцем `--allow-all-tools`) |
| Журнал | потрібна адаптація (власний JS-плагін `.opencode/plugins/agent-log.js` на подію `tool.execute.after`, поля `input.tool`, `input.args`, `input.sessionID`) | потрібна адаптація (конфіг `.github/hooks/agent-log.json` на події `postToolUse`/`postToolUseFailure` + скрипт `scripts/agent-log-hook.mjs`, події в camelCase `toolName`/`toolArgs`/`sessionId` та додавання теки в `trustedFolders` у `~/.copilot/config.json`) |
| Навичка | крок 04 | крок 04 |
| Заборона | крок 05 | крок 05 |
| MCP | крок 05 | крок 05 |
| Скріншот-тест | крок 06 | крок 06 |
