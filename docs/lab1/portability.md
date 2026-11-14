# Переносність між інструментами — Лабораторна 1

Значення: працює без змін / потрібна адаптація (яка) / не підтримується (чим замінили).

| Артефакт | OpenCode | GitHub Copilot CLI |
|---|---|---|
| AGENTS.md | працює без змін (читає кореневий `AGENTS.md` автоматично) | працює без змін (читає кореневий `AGENTS.md` автоматично) |
| Режим плану | потрібна адаптація (за замовчуванням `plan` забороняє `edit`, але дозволяє `bash`; додано `"permission": { "edit": "deny", "bash": "deny", "task": "deny" }` в `opencode.json`, запуск через `--agent plan`) | потрібна адаптація (префікс `/plan` у неінтерактивному запуску `-p ... --allow-all-tools` не гарантує блокування запису: у сесіях кроку 04 агент викликав `apply_patch`/`edit` і `powershell`) |
| Журнал | потрібна адаптація (власний JS-плагін `.opencode/plugins/agent-log.js` на подію `tool.execute.after`, поля `input.tool`, `input.args`, `input.sessionID`) | потрібна адаптація (конфіг `.github/hooks/agent-log.json` на події `postToolUse`/`postToolUseFailure` + скрипт `scripts/agent-log-hook.mjs`, події в camelCase `toolName`/`toolArgs`/`sessionId` та додавання теки в `trustedFolders` у `~/.copilot/config.json`) |
| Навичка | працює без змін (читає `.claude/skills/` і `.agents/skills/` за наявності полів `name` та `description` у лапках; у журналі видно як `"tool":"skill","input":{"name":"add-api-route"}`) | працює без змін (читає `.claude/skills/` і `.agents/skills/`; у журналі видно як `"tool":"skill","input":{"skill":"add-api-route"}`) |
| Заборона | крок 05 | крок 05 |
| MCP | крок 05 | крок 05 |
| Скріншот-тест | крок 06 | крок 06 |
