# Звіт · Лабораторна 1 — агентно-готовий репозиторій і власний агентний цикл

- **Автор:** Артур Винокур (`ArtuR188`)
- **Репозиторій:** `https://github.com/ArtuR188/Agent-Engineering`
- **Деплой:** `POST https://agent-engineering-kappa.vercel.app/api/agent` (та `GET /api/health`)
- **Період роботи:** `2026-10-22` — `2026-11-15`
- **Пара агентів кодування:** OpenCode CLI (`1.19.3`) + GitHub Copilot CLI (`1.0.112`)

Цей файл узагальнює хід роботи за структурою «що було → що зроблено → як це працює → ключові числа → висновки → як перевірити → використання ШІ». Детальні протоколи та пермалінки на рядки журналів зібрано у [`docs/lab1/README.md`](./README.md), хронологія сесій — у [`docs/lab1/autonomy-log.md`](./autonomy-log.md).

## Коротко

- Репозиторій однаково працює у двох інструментах CLI: спільні правила (`AGENTS.md`), спільні навички (`.agents/skills/add-api-route/`), хуки захисту `.env` та журнали дій у форматі JSONL.
- Контроль над агентами підтверджено артефактами: статус `denied` від хука `guard-env` у обох інструментах, експеримент скорочення `AGENTS.md` до ≤ 40 рядків, аналіз впевнених помилок, тест спрацьовування навички, зелені `typecheck`, `lint`, `test` і `build`.
- Реалізовано власний агентний цикл (`src/agent/agent-loop.ts`) із лімітом кроків (`maxSteps`), бюджетом токенів (`tokenBudget`), валідацією схеми Zod і двома адаптерами API (`Messages` і `Chat Completions`), а також перенесено цикл на AI SDK 7 (`src/agent/agent-aisdk.ts`) із підтвердженням деструктивного запису (`write_file` під `user-approval`).
- Задеплоєно обробник `/api/agent` на Vercel з експортом трас OpenTelemetry у Langfuse Cloud (`after(() => langfuseSpanProcessor.forceFlush())`), отримано 3 траси з викликом інструмента `getTime`, токенами й вартістю.
- Головні висновки: `gemini-3.8-flash` на стороні Google часто повертав `503 UNAVAILABLE` / таймаут, тому робочою хмарною моделлю обрано `gemini-3.5-flash-lite` (а резервом — `inclusionai/ling-3.2-flash:free` через OpenRouter); локальний кеш у `qwen3:4b` скорочує повторне читання префікса; драбина довіри має бути зафіксована кодом і хуками, а не лише текстом у промпті.

## 1. Що було на старті

- **Стек шаблону:** Next.js `16.3.4` (App Router), TypeScript `strict`, Vitest `5.0.0`, Playwright.
- **Стартова сторінка:** головна сторінка із завданням додати ендпоінт `/api/health`.
- **Середовище розробки:** Windows, Node.js 24, `OpenCode CLI 1.19.3`, `GitHub Copilot CLI 1.0.112`, `Ollama 0.40.13` (`qwen3:4b`, `nomic-embed-text`), Google AI Studio, Vercel Hobby, Langfuse Cloud Hobby.

## 2. Що в репозиторії тепер

- `AGENTS.md`, `.agents/skills/add-api-route/SKILL.md` — правила та навичка створення API-маршрутів.
- `.agent-log/` — журнали дій (`opencode.jsonl`, `copilot.jsonl`, `agent-loop.jsonl`).
- `scripts/guard-env.mjs`, `.opencode/plugins/guard-env.js`, `.github/hooks/guard-env.json` — захист `.env*` та логування `denied`.
- `app/api/health/route.ts`, `src/health.ts`, `tests/health.test.ts` — ендпоінт здоров'я та модульні тести.
- `app/api/agent/route.ts`, `instrumentation.ts`, `instrumentation.node.ts`, `src/otel/langfuse.ts` — задеплоєний агент на Vercel із трасуванням Langfuse.
- `src/cost.ts`, `src/models.ts`, `scripts/measure-cost.ts` — реєстр моделей і облік вартості.
- `src/agent/agent-loop.ts`, `src/agent/tools.ts`, `src/agent/adapters.ts`, `scripts/measure-loop.ts` — власний агентний цикл.
- `src/agent/agent-aisdk.ts` — цикл на AI SDK 7 з `toolApproval: { write_file: 'user-approval' }`.
- `docs/lab1/` — пакет доказів, скріншоти (`e2e-home.png`, `traces/*.png`) та звіти.
- **Гілки:** `main`, `lab1/agents-md-40-full`, `lab1/agents-md-40-cut`, `lab1/health-opencode`, `lab1/health-copilot`, `lab1/health-loop`.

## 3. Як це працює

- **Правила та план (`AGENTS.md`):** стислий регламент (≤ 40 рядків), заборона читання/зміни `.env*`, обов'язкові перевірки `typecheck`, `lint`, `test`, `build`.
- **Захист секретів (`guard-env`):** перехоплює спроби звернення до `.env` / `.env.local` до виконання інструмента, повертає `deny` і фіксує `"result": "denied"` у журналі.
- **Навичка `add-api-route`:** задає контракт маршруту, Zod-схему, тести й перевірку скриптом `scripts/check-route.mjs`.
- **Власний цикл проти AI SDK 7:** власний цикл (`agent-loop.ts` + `tools.ts` + `adapters.ts`) явно керує `maxSteps`, `tokenBudget`, Zod-валідацією та форматами API (`Messages` і `Chat Completions`); цикл на AI SDK 7 (`agent-aisdk.ts`) скорочує обсяг коду циклу та додає `toolApproval` для `write_file`.
- **Деплой і траси:** `/api/agent` працює на Vercel Hobby, `after(() => langfuseSpanProcessor.forceFlush())` гарантує відправку спанів у Langfuse Cloud.

## 4. Ключові числа й результати вимірів

| Метрика | Значення | Джерело |
|---|---|---|
| Модульні тести | 91 тест у 7 файлах, 100% зелені | `npm test` |
| Оцінка входу Gemini vs факт | `15 613` vs `15 613` токенів (похибка `0.0%`) | [`docs/lab1/cost.md`](./cost.md) |
| Кеш локальної моделі (Ollama `qwen3:4b`) | `1 962` кешовані токени з `1 963` | [`docs/lab1/cost.md`](./cost.md) |
| Множник кирилиці `ua / en` | `1.73` (`gemini-3.8-flash`) · `2.75` (`qwen3:4b`) | [`docs/lab1/cost.md`](./cost.md) |
| Прогони циклу (3 провайдери) | `gemini` (`done`, 8 169 мс), `openrouter` (`done`, 105 936 мс), `ollama` (`done` у `chat`, `max-steps` у `messages`) | [`docs/lab1/cost.md`](./cost.md), [`docs/lab1/comparison.md`](./comparison.md) |
| E2E-скріншот Playwright | [`docs/lab1/e2e-home.png`](./e2e-home.png) | `tests/home-health-link.spec.ts` |
| Траси деплою Langfuse | 3 траси з викликом `getTime`, токенами й вартістю (`$0.000263`) | [`docs/lab1/traces/`](./traces/) |

## 5. Що з'ясувалося під час роботи

- **Режим плану ловить зайві рішення:** перевірка плану до написання коду запобігає зайвим залежностям і неправильним патернам.
- **Локальний кеш прискорює повторні запити:** повторне використання префікса в Ollama зменшує час обробки на повторному виклику.
- **Reasoning-моделі (`qwen3:4b`) потребують лімітів і чіткого формату виходу:** без достатнього `maxTokens` та прикладу JSON модель витрачає ліміт на `<think>` і зупиняється на `maxSteps`.
- **Стабільність хмарних моделей:** заміна перевантаженої `gemini-3.8-flash` (`HTTP 503`) на `gemini-3.5-flash-lite` забезпечила стабільний час відповіді й успішний деплой.

## 6. Як перевірити проєкт самостійно

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run sync:skills
```

```powershell
$url = '[https://agent-engineering-kappa.vercel.app/api/agent](https://agent-engineering-kappa.vercel.app/api/agent)'
Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body '{"prompt":"Котра зараз година?"}'
```

## 7. Використання ШІ

Роботу виконано з використанням агентів кодування (`OpenCode CLI 1.19.3`, `GitHub Copilot CLI 1.0.112`) та AI-асистента для діагностики помилок, налаштування хуків і оформлення звітності. Правила `AGENTS.md`, контрольні обмеження, налаштування секретів, деплой на Vercel, виміри вартості та аналіз помилок виконані самостійно; хронологія та рівні довіри зафіксовані в [`docs/lab1/autonomy-log.md`](./autonomy-log.md).
