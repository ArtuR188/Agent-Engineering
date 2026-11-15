# Пакет доказів — Лабораторна робота 1 (Agent Engineering)

## 1. Інструменти

- **OpenCode CLI:** `1.19.3` (вивід `opencode --version`, провайдер OpenCode Zen / локальна інтеграція)
- **GitHub Copilot CLI:** `GitHub Copilot CLI 1.0.112` (вивід `copilot --version`)
- **Локальний сервер моделей Ollama:** `0.40.13` (модель `qwen3:4b`, `nomic-embed-text`)
- **Стек застосунку та агентного циклу:** Node.js 24, TypeScript 5 (`strict`), Next.js `16.3.4`, AI SDK `7.0.173` (`ai`, `@ai-sdk/google`), OpenTelemetry + Langfuse (`@langfuse/otel`, `@langfuse/vercel-ai-sdk`)

## 2. Як запустити у двох інструментах

### OpenCode CLI (`1.19.3`)
```powershell
# 1. Синхронізація правил та навичок
npm run sync:skills

# 2. Запуск у режимі плану (read-only, права edit/bash/task = deny у opencode.json)
opencode run --agent plan "Проаналізуй src/health.ts і склади план створення маршруту /api/health"

# 3. Запуск виконання задачі з логуванням у .agent-log/opencode.jsonl та захистом .env
opencode run "Створи маршрут /api/health за навичкою add-api-route і перевір тестами"
```

### GitHub Copilot CLI (`1.0.112`)
```powershell
# 1. Запуск у режимі плану
copilot -p "/plan Проаналізуй src/health.ts і склади план створення маршруту /api/health"

# 2. Запуск виконання задачі з хуками .github/hooks/agent-log.json та guard-env.json
copilot -p "Створи маршрут /api/health за навичкою add-api-route і перевір тестами" --allow-all-tools
```

### Запуск власного циклу та циклу на AI SDK 7
```powershell
# Власний цикл (крок 08 / крок 11 — порівняння трьох провайдерів):
npx tsx --env-file=.env.local scripts/measure-loop.ts gemini 1
npx tsx --env-file=.env.local scripts/measure-loop.ts openrouter 1
npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-messages 1

# Агентний цикл на AI SDK 7 з підтвердженням деструктивної дії write_file (крок 09):
npx tsx --env-file=.env.local src/agent/agent-aisdk.ts gemini
```

---

## 3. Документи пакета (`docs/lab1/`)

- [`agents-md-40.md`](./agents-md-40.md) — експеримент скорочення `AGENTS.md` до ≤ 40 рядків (крок 02)
- [`confident-errors.md`](./confident-errors.md) — аналіз впевнених помилок агента та галюцинацій (крок 03)
- [`skill-trigger.md`](./skill-trigger.md) — перевірка спрацьовування навички `add-api-route` та скрипта `scripts/check-route.mjs` (крок 04)
- [`context-cost.md`](./context-cost.md) — вартість контексту, хук захисту `.env` та підключення MCP `context7` (крок 05)
- [`portability.md`](./portability.md) — таблиця переносності артефактів між OpenCode та GitHub Copilot CLI (кроки 03–06)
- [`e2e-home.png`](./e2e-home.png) — скріншот браузерного E2E-тесту Playwright (`tests/home-health-link.spec.ts`, крок 06)
- [`cost.md`](./cost.md) — звірка оцінки токенів (≤ 10%), кешування, множник `ua / en` та таблиця трьох прогонів (кроки 07, 11)
- [`comparison.md`](./comparison.md) — порівняння агентів кодування, власного циклу (Messages vs Chat Completions) та AI SDK 7 (кроки 08, 09)
- [`model-decision.md`](./model-decision.md) — рішення про заміну моделі з цифрами «до» і «після», ризиками `retiresNotBefore` та політикою даних (крок 11)
- [`autonomy-log.md`](./autonomy-log.md) — журнал автономності (сесії за різні дати + обґрунтування мови артефактів `ua / en`)
- [`intro-draft.md`](./intro-draft.md) — чернетка «Вступу» курсової роботи (багатоагентний рефакторинг коду з графами знань AST проти векторного RAG)

---

## 4. Журнали дій агентів (`.agent-log/`) — постійні посилання на рядки

- **Повні файли журналів:**
  - [.agent-log/opencode.jsonl](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl)
  - [.agent-log/copilot.jsonl](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl)
  - [.agent-log/agent-loop.jsonl](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl)
- **Виклик навички `add-api-route` (крок 04):**
  - OpenCode (	ool: "skill"): [.agent-log/opencode.jsonl#L21](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl#L21), [#L36](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl#L36), [#L48](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl#L48)
  - Copilot CLI (	ool: "skill"): [.agent-log/copilot.jsonl#L12](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl#L12), [#L32](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl#L32), [#L40](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl#L40)
- **Блокування доступу до `.env` хуком `guard-env` (`result: "denied"`, крок 05):**
  - OpenCode (write та ash до .env): [.agent-log/opencode.jsonl#L85-L87](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl#L85-L87)
  - Copilot CLI (pply_patch та powershell до .env): [.agent-log/copilot.jsonl#L79-L81](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl#L79-L81)
- **Виклики MCP-сервера `context7` (крок 05):**
  - OpenCode (context7_resolve-library-id, context7_query-docs): [.agent-log/opencode.jsonl#L88-L89](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/opencode.jsonl#L88-L89)
  - Copilot CLI (context7-resolve-library-id, context7-query-docs): [.agent-log/copilot.jsonl#L82-L83](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/copilot.jsonl#L82-L83)
- **Власний агентний цикл (`agent-loop.jsonl`, кроки 08, 11):**
  - ollama-messages: [.agent-log/agent-loop.jsonl#L1](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L1)
  - ollama-chat: [.agent-log/agent-loop.jsonl#L2-L3](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L2-L3)
  - openrouter (inclusionai/ling-3.2-flash:free): [.agent-log/agent-loop.jsonl#L4-L5](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L4-L5)
  - gemini (gemini-3.5-flash-lite): [.agent-log/agent-loop.jsonl#L6-L16](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L6-L16)

---

## 5. Гілки порівняльних експериментів та CI (GitHub Actions)

- **Гілки `AGENTS.md` (крок 02):**
  - [lab1/agents-md-40-full](https://github.com/ArtuR188/Agent-Engineering/tree/lab1/agents-md-40-full)
  - [lab1/agents-md-40-cut](https://github.com/ArtuR188/Agent-Engineering/tree/lab1/agents-md-40-cut)
- **Гілки реалізації `/api/health` (кроки 04, 08):**
  - [lab1/health-opencode](https://github.com/ArtuR188/Agent-Engineering/tree/lab1/health-opencode) (коміт  6e5795)
  - [lab1/health-copilot](https://github.com/ArtuR188/Agent-Engineering/tree/lab1/health-copilot) (коміт 043db2)
  - [lab1/health-loop](https://github.com/ArtuR188/Agent-Engineering/tree/lab1/health-loop) (коміт c21d48d)
- **Прогони GitHub Actions CI:**
  - Зелений прогін main (erify + e2e): https://github.com/ArtuR188/Agent-Engineering/actions/runs/43743388740
  - Червоний прогін (erify failed / «поганий патч»): https://github.com/ArtuR188/Agent-Engineering/actions/runs/43722968806

---

## 6. Задеплоєний ендпоінт із трасуванням OpenTelemetry у Langfuse (Крок 10)

- **Адреса публічного ендпоінта (Vercel):** `https://agent-engineering-kappa.vercel.app/api/agent`
- **Перевірка стану (Healthcheck):** `https://agent-engineering-kappa.vercel.app/api/health`
- **Скріншоти трас із токенами й вартістю (`docs/lab1/traces/`):**
  - Загальний список трас: [`traces/traces-list.png`](./traces/traces-list.png)
  - Траса 1 (`Котра зараз година?`, виклик `getTime`): [`traces/trace-1.png`](./traces/trace-1.png)
  - Траса 2 (`Скільки хвилин лишилось до півночі?`, виклик `getTime`): [`traces/trace-2.png`](./traces/trace-2.png)
  - Траса 3 (`Привітайся одним реченням`): [`traces/trace-3.png`](./traces/trace-3.png)

### Команда виклику (PowerShell)
```powershell
$url = '[https://agent-engineering-kappa.vercel.app/api/agent](https://agent-engineering-kappa.vercel.app/api/agent)'
'Котра зараз година?', 'Скільки хвилин лишилось до півночі?', 'Привітайся одним реченням' | ForEach-Object {
  $body = @{ prompt =$_ } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body$body | ConvertTo-Json -Compress -Depth 5
}
```

### Команда виклику (Bash / curl)
```bash
URL='[https://agent-engineering-kappa.vercel.app/api/agent](https://agent-engineering-kappa.vercel.app/api/agent)'
for p in 'Котра зараз година?' 'Скільки хвилин лишилось до півночі?' 'Привітайся одним реченням'; do
  printf '{"prompt":"%s"}' "$p" | curl -s -X POST "$URL" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-; echo
done
```
