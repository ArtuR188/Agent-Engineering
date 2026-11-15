# Повний звіт — Лабораторна робота 1

---

<!-- Файл: docs/lab1/README.md -->

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

---

<!-- Файл: docs/lab1/agents-md-40.md -->

# Тест «видали 40%» — AGENTS.md

## Параметри експерименту

- **Рядків до тесту:** 31
- **Видалено:** 13 рядків (41.9%)
- **Коміт із видаленням:** `62b4b35` у гілці `lab1/agents-md-40-cut`
- **Контрольна задача (запит дослівно):** «Додай у src/utils.ts функцію formatDuration(ms: number): string, яка переводить мілісекунди у формат 'Xm Ys', покрий її тестами у src/utils.test.ts та повідом, коли готово.»
- **Інструмент та середовище:** GitHub Copilot CLI 1.0.98, модель GPT-6 Luna, режим `--allow-all-tools`
- **Гілка з повним файлом:** `lab1/agents-md-40-full`
- **Гілка з урізаним файлом:** `lab1/agents-md-40-cut`

---

## Порівняльний аналіз поведінки агента

| Видалений рядок | Що змінилося в поведінці | Доказ (лог сесії) | Рішення |
| :--- | :--- | :--- | :--- |
| `- npm run lint — лінтер.` та вимога обов'язкових перевірок перед «готово» | Агент припинив запускати ESLint, обмежившись лише тестами та компілятором | Запустив `npm test` і `npm run typecheck`; команду `npm run lint` повністю проігнорував | Повернути |
| `- Не чіпати package.json, package-lock.json...` | Поведінка не змінилася | Маніфест і лок-файл залишилися недоторканими | Повернути |
| `- Якщо падає тест: спочатку пояснити причину багу в коді...` | Поведінка не перевірялася | Тести пройшли успішно з першої спроби (61 passed) | Повернути |
| `- Мова відповідей та коментарів у коді — українська.` | Поведінка не змінилася | Модель підхопила мову з тексту промпту | Повернути |

---

## Підсумок

Повернуто всі 13 видалених рядків. Фінальний розмір `AGENTS.md` у гілці `main` — 31 рядок.

---

## Висновок

1. **Експериментальне підтвердження гіпотези:** Видалення 41.9% вмісту файлу наочно продемонструвало пряму залежність поведінки агента від явних декларативних правил. Після вилучення вимоги щодо лінтера агент самостійно пропустив виконання `npm run lint`, обмежившись лише тестами та компілятором. Це доводить, що цей рядок не є баластом, а критично необхідний для дотримання стандарту коду.
2. **Контекст проти інструкцій:** Агент зберіг українську мову та не чіпав залежності лише завдяки контексту самого запиту, проте інженерні перевірки без жорсткої фіксації в `AGENTS.md` деградують у першу чергу.
3. **Фінальне рішення:** Усі вилучені рядки відновлено у гілці `main` (31 рядок). Файл повністю відповідає критерію «кожен рядок запобігає конкретній помилці» і вкладається у норматив заняття (до 60 рядків).
---

<!-- Файл: docs/lab1/confident-errors.md -->

# Впевнені помилки — Лабораторна 1

## Плани: задача /api/health

| Інструмент | Режим | Файли, які збирався чіпати | Чим збирався довести | Збігається з контрактом? |
|---|---|---|---|---|
| OpenCode (`big-pickle`) | `plan` (`--agent plan`) | Створити лише `app/api/health/route.ts` | `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` | Так (врахував `GET()` без параметрів, тип `HealthResponse` і відносний імпорт `../../../src/health`) |
| GitHub Copilot CLI (`GPT-6 Luna`) | `/plan` | Створити лише `app/api/health/route.ts` | `npm test -- tests/health.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build` | Частково (не згадав імпорт типу `HealthResponse`, не перевірив `tsconfig.json`/`vitest.config.ts`, звузив запуск тестів до одного файлу) |

## Помилки

| # | Інструмент | Режим | Що запропоновано / заявлено | Що насправді (executed) | Чому це помилка | Як спіймали | Рядок журналу |
|---|---|---|---|---|---|---|---|
| 1 | GitHub Copilot CLI | `/plan` | Заявив план створення `app/api/health/route.ts` і перевірку лише одного файлу `npm test -- tests/health.test.ts` | Прочитав тільки `src/health.ts`, `tests/health.test.ts`, `package.json` і `glob **/route.ts`; не прочитав `tsconfig.json` та `vitest.config.ts` | Пропуск аналізу конфігурації тест-раннера в режимі плану створює ризик використання аліасу `@/*`, який не резолвиться у Vitest; частковий прогін тестів у плані суперечить `AGENTS.md` | читання плану та журналу | [copilot.jsonl#L6](https://github.com/ArtuR188/Agent-Engineering/blob/f043db249f7a090fc02e75d7b9ded9a70693a8c3/.agent-log/copilot.jsonl#L6) · `2026-11-14T11:50:41.569Z` · `glob` |
| 2 | GitHub Copilot CLI | `build` (`--allow-all-tools`) | Заявив, що реалізував `GET /api/health` за наявною схемою `src/health.ts` | Створив `app/api/health/route.ts` через `apply_patch` без імпорту `HealthResponse` з `src/health.ts` (повернув нетипізований літерал об'єкта) | Відсутність компіляційної перевірки `const body: HealthResponse` у `route.ts`: при зміні контракту в `src/health.ts` перевірка `npm run typecheck` не виявить розбіжність у самому обробнику маршруту | читання `git diff lab1/health-opencode lab1/health-copilot -- app/` | [copilot.jsonl#L7](https://github.com/ArtuR188/Agent-Engineering/blob/f043db249f7a090fc02e75d7b9ded9a70693a8c3/.agent-log/copilot.jsonl#L7) · `2026-11-14T11:57:46.737Z` · `apply_patch` |
| 3 | GitHub Copilot CLI | `build` (`--allow-all-tools`) | У фінальному звіті заявив «готово, усі перевірки пройшли... у збірці маршрут відображається як `/api/health`» без доказу (виводу) | Запустив `npm run build`, але у звіті не навів вивід таблиці маршрутів і не вказав маркер динамічного рендерингу `ƒ /api/health` | Клас «готово без доказу»: порушення правила `AGENTS.md` («надати вивід»); без маркера `ƒ` неможливо переконатися зі звіту, що маршрут не скомпілювався як статичний `○` із застиглим `timestamp` | читання звіту та ручний запуск `npm run build` | [copilot.jsonl#L11](https://github.com/ArtuR188/Agent-Engineering/blob/f043db249f7a090fc02e75d7b9ded9a70693a8c3/.agent-log/copilot.jsonl#L11) · `2026-11-14T11:57:57.819Z` · `powershell` |
| 4 | OpenCode | `build` (`--agent build`) | Заявив, що маршрут гарантовано динамічний (`ƒ /api/health`) лише за рахунок `GET()` з `new Date().toISOString()` | Записав `app/api/health/route.ts` без явного сегментного конфігу `export const dynamic = 'force-dynamic'` | У Next.js App Router `GET()` без об'єкта `Request` і без `force-dynamic` покладається на евристику бандлера; за кешування Route Handler без явного `dynamic = 'force-dynamic'` `timestamp` може закешуватися при статичній оптимізації | читання коду `app/api/health/route.ts` та журналу | [opencode.jsonl#L16](https://github.com/ArtuR188/Agent-Engineering/blob/06e57956fe1463a88b3e1b1057a0a7cf08c954f8/.agent-log/opencode.jsonl#L16) · `2026-11-14T11:43:44.973Z` · `write` |
| 5 | GitHub Copilot CLI | `/plan` (`-p "/plan ..." --allow-all-tools`) | Запит подано з префіксом `/plan` (очікувався режим «лише читання та план») | У сесіях тестування навички попри `/plan` виконав модифікацію файлів (`apply_patch`, `edit`) та запустив shell-команди (`powershell`) | Клас «режим плану — не лише читання»: слеш-команда `/plan` у неінтерактивному запуску `-p` з `--allow-all-tools` не блокує інструменти запису на рівні дозволів | читання журналу `.agent-log/copilot.jsonl` та `git status --short` | [copilot.jsonl#L24](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L24) · `2026-11-14T13:04:44.430Z` · `apply_patch` |

---

<!-- Файл: docs/lab1/skill-trigger.md -->

# Тест на спрацювання навички add-api-route

Опис (description) на момент тесту: "Додає API-маршрут у app/api цього проєкту: схема zod у src/, обробник route.ts і тест Vitest у tests/. Використовуй, коли просять новий ендпоінт, API-маршрут чи обробник HTTP-запиту. Не використовуй для змін сторінок, компонентів і стилів."

| # | запит (без назви навички) | очікую | OpenCode: сталося | доказ (ts · tool) | GitHub Copilot CLI: сталося | доказ (ts · tool) |
|---|---|---|---|---|---|---|
| 1 | Додай ендпоінт /api/version, який повертає версію з package.json | бере | бере (`add-api-route`) | [opencode.jsonl#L21](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L21) · `2026-11-14T12:51:11.087Z` · `skill` | бере (`add-api-route`) | [copilot.jsonl#L12](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L12) · `2026-11-14T13:04:23.041Z` · `skill` |
| 2 | Потрібен API-маршрут, що віддає список ролей моделей із src/models.ts | бере | бере (`add-api-route`) | [opencode.jsonl#L36](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L36) · `2026-11-14T12:51:50.133Z` · `skill` | бере (`add-api-route`) | [copilot.jsonl#L32](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L32) · `2026-11-14T13:05:23.217Z` · `skill` |
| 3 | Зроби обробник POST /api/echo, який повертає тіло запиту | бере | бере (`add-api-route`) | [opencode.jsonl#L48](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L48) · `2026-11-14T12:52:20.919Z` · `skill` | бере (`add-api-route`) | [copilot.jsonl#L40](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L40) · `2026-11-14T13:05:55.101Z` · `skill` |
| 4 | Зміни заголовок на головній сторінці | не бере | не бере (почав із `glob`) | [opencode.jsonl#L63](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L63) · `2026-11-14T12:53:06.505Z` · `glob` | не бере (почав із `glob`) | [copilot.jsonl#L54](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L54) · `2026-11-14T13:06:55.492Z` · `glob` |
| 5 | Напиши тест для src/models.ts | не бере | не бере (почав із `read`) | [opencode.jsonl#L69](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L69) · `2026-11-14T12:53:23.431Z` · `read` | не бере (почав із `view`) | [copilot.jsonl#L68](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L68) · `2026-11-14T13:07:37.566Z` · `view` |
| 6 | Поясни, що робить app/api/health/route.ts | не бере | не бере (почав із `read`) | [opencode.jsonl#L82](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/opencode.jsonl#L82) · `2026-11-14T12:53:51.063Z` · `read` | не бере (почав із `view`) | [copilot.jsonl#L78](https://github.com/ArtuR188/Agent-Engineering/blob/04c438613f5d07899220e95aa2e99774bf32367e/.agent-log/copilot.jsonl#L78) · `2026-11-14T13:08:26.903Z` · `view` |

Висновок: збіглося 12 з 12 з першої спроби (усі 3 позитивні запити викликали інструмент `skill` для `add-api-route` в обох інструментах, усі 3 негативні запити виконано без виклику навички). Потреби змінювати `description` не виникло: опис містить чітке дієслово дії («Додає API-маршрут у app/api...»), ключові слова предметної області («новий ендпоінт, API-маршрут чи обробник HTTP-запиту») та явне відсікання сусідніх задач («Не використовуй для змін сторінок, компонентів і стилів»), а взяття рядка в подвійні лапки зберегло коректний розбір YAML frontmatter із двокрапкою.

---

<!-- Файл: docs/lab1/context-cost.md -->

# Ціна контексту: базова лінія і MCP-сервер

| інструмент | шар / сервер | до | після | як виміряно | навіщо |
|---|---|---|---|---|---|
| OpenCode (`big-pickle`) | базова лінія, свіжа сесія | не вимірюється (команди `/context` немає) | — | довідка OpenCode CLI | — |
| OpenCode (`big-pickle`) | `context7` після реального виклику (`context7_resolve-library-id` + `context7_query-docs`) | не вимірюється | транскрипт сесії з відповіддю MCP: **11 333 символи** (оцінка за розміром відповіді) | `opencode export ses_e25b0042dffe8KDFOmTBqkpT0S --sanitize` ([opencode.jsonl#L88-L89](https://github.com/ArtuR188/Agent-Engineering/blob/1dc2d798804148785d239a54e6f2350c7e782463/.agent-log/opencode.jsonl#L88)) | актуальні API Next.js 16 (App Router `route.ts`) і Zod 4 замість вгаданих |
| GitHub Copilot CLI (`GPT-6 Luna`) | базова лінія, один запит без MCP | **17.4k – 33.0k** вхідних токенів | — | лічильник `Tokens ↑` у підсумку сесії CLI (`690011b2`, `4e0d4d8c`) | — |
| GitHub Copilot CLI (`GPT-6 Luna`) | `context7` після реального виклику (`context7-resolve-library-id` + `context7-query-docs`) | **33.0k** токенів | **54.6k** вхідних токенів (`46.5k cached, 8.1k written`), ріст **+21.6k токенів** (~8.1k нових токенів документації та схем) | лічильник `Tokens ↑` до і після запиту «Через Context7 знайди в документації Next.js, як в App Router оголосити обробник GET у route.ts» ([copilot.jsonl#L82-L83](https://github.com/ArtuR188/Agent-Engineering/blob/1dc2d798804148785d239a54e6f2350c7e782463/.agent-log/copilot.jsonl#L82)) | актуальні API Next.js 16 і офіційні конвенції `route.ts` замість застарілих рецептів |

Висновок: сервер `context7` залишаю підключеним (без API-ключа в публічному репозиторії: в `opencode.json` лише публічний URL `https://mcp.context7.com/mcp`, а для Copilot CLI — у користувацькому `~/.copilot/mcp-config.json`), оскільки він дає точні сигнатури Next.js 16 та Zod 4. Водночас один реальний виклик додає в історію сесії понад 8 000 токенів (~11.3 тис. символів у транскрипті OpenCode та +21.6k сумарного входу на двох кроках у Copilot CLI), які пересилаються в кожному наступному ході. Якщо контекст стане тісним або задача не потребуватиме зовнішньої документації, вимикатиму `context7` у `opencode.json` або викликатиму пошук документації в окремій короткій сесії режиму `plan`.

---

<!-- Файл: docs/lab1/portability.md -->

# Переносність між інструментами — Лабораторна 1

Значення: працює без змін / потрібна адаптація (яка) / не підтримується (чим замінили).

| Артефакт | OpenCode | GitHub Copilot CLI |
|---|---|---|
| AGENTS.md | працює без змін (читає кореневий `AGENTS.md` автоматично) | працює без змін (читає кореневий `AGENTS.md` автоматично) |
| Режим плану | потрібна адаптація (за замовчуванням `plan` забороняє `edit`, але дозволяє `bash`; додано `"permission": { "edit": "deny", "bash": "deny", "task": "deny" }` в `opencode.json`, запуск через `--agent plan`) | потрібна адаптація (префікс `/plan` у неінтерактивному запуску `-p ... --allow-all-tools` не гарантує блокування запису: у сесіях кроку 04 агент викликав `apply_patch`/`edit` і `powershell`) |
| Журнал | потрібна адаптація (власний JS-плагін `.opencode/plugins/agent-log.js` на подію `tool.execute.after`, поля `input.tool`, `input.args`, `input.sessionID`) | потрібна адаптація (конфіг `.github/hooks/agent-log.json` на події `postToolUse`/`postToolUseFailure` + скрипт `scripts/agent-log-hook.mjs`, події в camelCase `toolName`/`toolArgs`/`sessionId` та додавання теки в `trustedFolders` у `~/.copilot/config.json`) |
| Навичка | працює без змін (читає `.claude/skills/` і `.agents/skills/` за наявності полів `name` та `description` у лапках; у журналі видно як `"tool":"skill","input":{"name":"add-api-route"}`) | працює без змін (читає `.claude/skills/` і `.agents/skills/`; у журналі видно як `"tool":"skill","input":{"skill":"add-api-route"}`) |
| Заборона | потрібна адаптація (маски `permission.read` / `permission.edit` в `opencode.json` не бачать команд `bash` і не пишуть у журнал, тому додано плагін `.opencode/plugins/guard-env.js` на подію `tool.execute.before`, який пише `"result":"denied"` і кидає `Error`) | потрібна адаптація (налаштовано `.github/hooks/guard-env.json` на подію `preToolUse` + спільний Node-скрипт `scripts/guard-env.mjs`, що перевіряє `apply_patch`, `path`, `command`, дописує `"result":"denied"` у журнал і повертає `permissionDecision: "deny"` з кодом виходу `2`) |
| MCP | потрібна адаптація (підключається у `opencode.json` у блоці `"mcp": { "context7": { "type": "remote", "url": "https://mcp.context7.com/mcp" } }`; інструменти отримують префікс `context7_resolve-library-id`, `context7_query-docs`) | потрібна адаптація (підключається у користувацькому `~/.copilot/mcp-config.json` у блоці `"mcpServers": { "context7": { "type": "http", "url": "https://mcp.context7.com/mcp" } }`; інструменти називаються через дефіс `context7-resolve-library-id`, `context7-query-docs`) |
| Скріншот-тест | працює без змін (Playwright-тест `tests/home-health-link.spec.ts` не залежить від агента кодування) | працює без змін (Playwright-тест `tests/home-health-link.spec.ts` не залежить від агента кодування) |

---

<!-- Файл: docs/lab1/cost.md -->

# Вартість викликів — Лабораторна 1

Ollama: `0.40.13` (`qwen3:4b`) · дата вимірів: `2026-11-14` – `2026-11-15`

## 1. Звірка оцінки вхідних токенів (хмарна модель, критерій ≤ 10%)

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gemini-1 | google | gemini-3.8-flash | 15613 | 0 | 726 | 15613 | 0.0 | 0.000000 | 0.014432 | 18732 | 2026-11-14 |
| gemini-2 | google | gemini-3.8-flash | 15613 | 13360 | 717 | 15613 | 0.0 | 0.000000 | 0.014398 | 34305 | 2026-11-14 |

Команда: `npx tsx --env-file=.env.local scripts/measure-cost.ts gemini`
Чим оцінено до виклику: Gemini countTokens (REST, generateContentRequest) · факт: usageMetadata.promptTokenCount
Сирий usageMetadata другого виклику: `{"promptTokenCount":15613,"candidatesTokenCount":82,"totalTokenCount":16330,"cachedContentTokenCount":13360,"promptTokensDetails":[{"modality":"TEXT","tokenCount":15613}],"cacheTokensDetails":[{"modality":"TEXT","tokenCount":13360}],"thoughtsTokenCount":635,"serviceTier":"standard"}`

## 2. Кешування

Префікс: `scripts/doctor.ts` + `scripts/sync-skills.ts` + `src/models.ts` (для Ollama — перші 6000 символів).

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ollama-1 | ollama | qwen3:4b | 1963 | 0 | 64 | — | — | 0.000000 | 0.000000 | 48456 | 2026-11-14 |
| ollama-2 | ollama | qwen3:4b | 1963 | 1962 | 64 | — | — | 0.000000 | 0.000000 | 8900 | 2026-11-14 |

Назва поля кешу: `cache_read_input_tokens` · сирий usage другого виклику: `{"input_tokens":1,"cache_read_input_tokens":1962,"output_tokens":64}`
Для Ollama: це повторне використання префікса моделі, а не знижка в рахунку.

## 3. Множник «українська / англійська»

| Провайдер | Модель | Текст (про що, скільки слів) | Токени en | Токени ua | ua / en |
|---|---|---|---|---|---|
| google | gemini-3.8-flash | Правила перевірок і роботи з .env (36 слів) | 45 | 78 | 1.73 |
| ollama | qwen3:4b | Правила перевірок і роботи з .env (36 слів) | 44 | 121 | 2.75 |

Команда: `npx tsx --env-file=.env.local scripts/measure-cost.ts lang docs/lab1/cost.md`
Тексти, на яких виміряно множник (скрипт читає саме ці два блоки):

```ua
Цей репозиторій містить навчальні завдання з інженерії агентів. Агент повинен перевіряти стан коду через типізацію, лінтер, модульні тести та збірку перед завершенням задачі. Конфіденційні змінні середовища у файлах .env не можна читати або змінювати.
```

```en
This repository contains agent engineering exercises. The agent must verify code state using typechecking, linting, unit tests, and build before completing a task. Sensitive environment variables in .env files must not be read or modified.
```

## 4. Три прогони (крок 11)

Команди запуску з однаковим входом (`SYSTEM`, `TASK`, інструменти `list_files` і `read_file`):
- `npx tsx --env-file=.env.local scripts/measure-loop.ts gemini 1`
- `npx tsx --env-file=.env.local scripts/measure-loop.ts openrouter 1`
- `npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-messages 1` (та `ollama-chat 1`)

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gemini | gemini-3.5-flash-lite | 11570 | 0 | 373 | — | — | 0.000000 | 0.004404 | 8169 | 2026-11-15 |
| 2 | openrouter | inclusionai/ling-3.2-flash:free | 1612 | 576 | 1065 | — | — | 0.000000 | 0.000000 | 105936 | 2026-11-15 |
| 3 | ollama-messages | qwen3:4b | 9583 | 8412 | 24184 | — | — | 0.000000 | 0.000000 | 3251089 | 2026-11-14 |
| 4 | ollama-chat | qwen3:4b | 1334 | 948 | 3767 | — | — | 0.000000 | 0.000000 | 828106 | 2026-11-15 |

Посилання на записи сесій у журналі `.agent-log/agent-loop.jsonl`:
- gemini (gent-loop-gemini-2026-11-15T17-46-45-836Z): [.agent-log/agent-loop.jsonl#L6-L16](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L6-L16)
- openrouter (gent-loop-openrouter-2026-11-15T17-42-47-334Z): [.agent-log/agent-loop.jsonl#L4-L5](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L4-L5)
- ollama-messages (gent-loop-ollama-messages-2026-11-14T20-41-51-032Z): [.agent-log/agent-loop.jsonl#L1](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L1)
- ollama-chat (gent-loop-ollama-chat-2026-11-15T08-00-27-892Z): [.agent-log/agent-loop.jsonl#L2-L3](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L2-L3)

---

<!-- Файл: docs/lab1/comparison.md -->

# Та сама задача: /api/health

Контракт — `tests/health.test.ts`. Усі варіанти стартують від того самого коміту.
Якщо інструмент не показує токенів, пишіть «н/д» і чому.
Базовий коміт: `dded157` · коміт із застосованою пропозицією циклу: `a9eb659` (`lab1/health-loop`) · дата: `2026-11-15`

| Варіант | Інструмент / форма API | Модель | Кроки (виклики моделі) | Виклики інструментів | Вхідні | Вихідні | $ за прайсом | Час, с | health.test.ts | Доказ |
|---|---|---|---|---|---|---|---|---|---|---|
| Агент кодування | OpenCode CLI / Copilot CLI | хмарна модель агента | н/д (CLI не експортує лічильник кроків LLM) | 18 (OpenCode) / 9 (Copilot) | н/д (хук логує лише виклики інструментів без usage) | н/д | н/д | 432.35 / 437.40 | так | `.agent-log/opencode.jsonl` (`ses_e26265198ffeXPIDS4pE8LROnY`), `.agent-log/copilot.jsonl` (`9546a6bb-e7a4-41f8-8145-7ff68aa1bccb`), гілки `lab1/health-opencode` (`06e5795`), `lab1/health-copilot` (`f043db2`) |
| Ваш цикл · хмарно / Chat Completions | Chat Completions · Ollama (`ollama-chat`, резерв через HTTP 503 / timeout Gemini API) | `qwen3:4b` | 2 (`done`) | 2 | 1334 (кеш: 948) | 3767 | 0.000000 | 828.11 | так | `.agent-log/agent-loop.jsonl`, session `agent-loop-ollama-chat-2026-11-15T08-00-27-892Z`, коміт `a9eb659` |
| Ваш цикл · локально | Messages · Ollama (`ollama-messages`) | `qwen3:4b` | 12 (`max-steps`) | 1 | 9583 (кеш: 8412) | 24184 | 0.000000 | 3251.09 | ні | `.agent-log/agent-loop.jsonl`, session `agent-loop-ollama-messages-2026-11-14T20-41-51-032Z` |

## Дві форми API у вашому циклі

| Форма | Провайдер · baseURL | Виклик інструмента | Результат інструмента |
|---|---|---|---|
| Messages | Ollama · `http://localhost:11434/v1/messages` | блок `content[]` з `type: "tool_use"` (`id`, `name`, `input`) | повідомлення `role: "user"` з блоком `type: "tool_result"` (`tool_use_id`, `content`, `is_error`) |
| Chat Completions | Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) та Ollama (`http://localhost:11434/v1/chat/completions`) | поле `message.tool_calls[]` (`id`, `type: "function"`, `function.name`, `function.arguments`) | окремі повідомлення `role: "tool"` з `tool_call_id` та `content` |

## 10 прогонів: валідація схеми

Команда: `npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-messages 10` та `npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-chat 1`

| # | провайдер | форма API | модель | зупинка | кроки | вхідні | кешовані | вихідні | $ фактично | $ за прайсом | затримка, мс | session |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ollama-messages | messages | qwen3:4b | max-steps | 12 | 9583 | 8412 | 24184 | 0 | 0.000000 | 3251089 | agent-loop-ollama-messages-2026-11-14T20-41-51-032Z |
| 2 | ollama-messages | messages | qwen3:4b | max-steps | 12 | 9336 | 8228 | 3000 | 0 | 0.000000 | 327157 | agent-loop-ollama-messages-2026-11-14T22-22-18-122Z |
| 3 | gemini | chat-completions | gemini-3.8-flash | error (HTTP 503 / timeout) | 0 | 0 | 0 | 0 | 0 | 0.000000 | 90000 | н/д (перервано сервером Google до tool call) |
| 4 | ollama-chat | chat-completions | qwen3:4b | done | 2 | 1334 | 948 | 3767 | 0 | 0.000000 | 828106 | 
agent-loop-ollama-chat-2026-11-15T08-00-27-892Z
 |

Підсумок скрипта: «Валідних структурованих виходів: 1 з 1 у `ollama-chat` (`done`); 0 з 2 у `ollama-messages` (`max-steps` через CPU-генерацію блоків `<think>`)»

Прогони, що зупинилися на ліміті, і що змінено:
- **Прогін №1 (`agent-loop-ollama-messages-2026-11-14T20-41-51-032Z`):** зупинився на ліміті `max-steps` (12 кроків, 24 184 вихідні токени, 54,2 хв на 100% CPU без GPU). Причина: у локальному Modelfile `qwen3:4b` в кінці шаблону жорстко стоїть відкритий тег `<think>`, тому на кожному ході модель спочатку генерує роздуми і при читанні всього дерева файлів (`list_files(".")`) не вкладалася у `max_tokens: 2048` для закриття JSON, що викликало 11 повторних запитів схеми.
- **Прогін №2 (`agent-loop-ollama-messages-2026-11-14T22-22-18-122Z`):** спроба обмежити генерацію через `maxTokens: 250` також дала `max-steps` (12 × 250 = 3000 вихідних токенів, 327,16 с), оскільки 250 токенів обривали модель посеред блоку `"type": "thinking"` ще до початку генерації `"type": "text"` або `"type": "tool_use"`.
- **Спроби з хмарним `gemini` (`gemini-3.8-flash`):** повертали `HTTP 503 UNAVAILABLE (high demand)` та мережевий `timeout`. Згідно з методичкою застосовано штатний запасний варіант `ollama-chat` (`/v1/chat/completions`).
- **Що змінено для успішного проходження:** повернуто `maxTokens: 2048` (щоб блок роздумів `qwen3:4b` гарантовано завершувався), у системному та користувацькому промпті прямо вказано читати лише `src/health.ts` і `tests/health.test.ts` без зайвого `list_files(".")`. У результаті прогін `ollama-chat` завершився зі статусом `done` за 2 кроки (1334 вхідні токени, 948 кешованих, 3767 вихідних, 828,11 с) і видав валідний JSON за схемою Zod `Proposal`.

## Власний цикл vs AI SDK

| Що | Власний цикл (крок 08) | AI SDK 7 |
|---|---|---|
| Рядків коду разом з інструментами | **207** (`src/agent/agent-loop.ts` — 104 + `src/agent/tools.ts` — 103; разом із `src/agent/adapters.ts` на 169 рядків — **376**) | **105** (`src/agent/agent-aisdk.ts` разом із 3 інструментами, схемою `Report`, `runWithApproval` та CLI) |
| Історія повідомлень, розбір викликів інструментів, повтор | Власний код (~75 рядків у `runAgentLoop` + ~130 рядків у `adapters.ts`): ручне накопичення `messages.push(...)`, `Promise.all` для інструментів, `extractJson` і повтор при помилці схеми | `ToolLoopAgent` і `agent.generate()`: SDK сам веде історію (`first.responseMessages`), розбирає `tool-call` / `tool-result` і повторює кроки |
| Ліміт кроків | Власний лічильник у циклі `for (let step = 1; step <= cfg.maxSteps; step++)` із поверненням `stop: "max-steps"` | `stopWhen: isStepCount(maxSteps)` у конфігурації `ToolLoopAgent` |
| Бюджет токенів | Власна умова зупинки `if (usage.inputTokens + usage.outputTokens >= cfg.tokenBudget) return { stop: "token-budget", ... }` | Окремої опції немає (реалізується кастомною функцією-предикатом у `stopWhen: ({ steps }) => ...` або перевіркою суми `usage` між викликами `generate`) |
| Облік токенів | Власне підсумовування `addUsage(usage, turn.usage)` + ручна нормалізація полів через `fromMessagesUsage` / `fromChatUsage` | `result.usage` (підсумкова сума за виклик), `result.steps[i].usage` (за кроками; у `runWithApproval` сумується за двома викликами `generate`) |
| Валідація структурованого виходу | Власний `extractJson(turn.text)` + `cfg.output.safeParse(raw)` (Zod) із ручним додаванням тексту помилки в `messages` | `Output.object({ schema: Report })` → `result.output` (кидає `NoOutputGeneratedError`, якщо агент зупинився на `tool-calls` на ліміті кроків) |
| Підтвердження деструктивної дії | Немає (були лише безпечні інструменти читання `list_files` і `read_file`; запис виконувався б одразу або вимагав би ручного розриву циклу) | `toolApproval: { write_file: "user-approval" }` і два виклики `agent.generate()` у `runWithApproval` (`tool-approval-request` → рішення людини `ask()` → `tool-approval-response`) |
| Друга форма API або провайдер | Окремий адаптер у `src/agent/adapters.ts` (`messagesModel` і `chatCompletionsModel` на 169 рядків із ручним перекладом схем повідомлень) | Інший рядок у `pickModel()` (`google(...)`, `createOllama(...)` або `createOpenAICompatible(...)`) без змін у коді циклу |
| Що зникло / що з'явилося | **Зникло:** ~270 рядків рутинної інфраструктури — ручний `fetch`, пересилання масиву `messages`, парсинг JSON із тексту та переклад між форматами `tool_use` (Messages) і `tool_calls` (Chat Completions). | **З'явилося:** декларативна «драбина довіри» в коді через `toolApproval` (блокування деструктивного `write_file` до явного схвалення людиною), єдиний інтерфейс `LanguageModel` для зміни провайдера в один рядок і тестування без мережі через `MockLanguageModelV4`. |

## Висновки
- **Де кроків було більше і чому:** найбільше кроків (12 — стеля `max-steps`) було в `ollama-messages` до уточнення промпту та ліміту `maxTokens`, бо при обрізанні відповіді всередині блоку `<think>` `extractJson(turn.text)` повертав `undefined`, а цикл додавав у контекст помилку валідації Zod і запускав новий крок. Коли промпт звузили до прямого читання `src/health.ts` і `tests/health.test.ts` із достатнім запасом `maxTokens`, цикл вклався у мінімально можливі **2 кроки** (Крок 1 — паралельне читання двох файлів через `read_file`; Крок 2 — повернення JSON-пропозиції). У повноцінних агентів кодування викликів інструментів було більше (18 у OpenCode, 9 у Copilot), оскільки вони додатково досліджували структуру проєкту, записували файл на диск і самі запускали тести.
- **Що ваш цикл зробив гірше за агента кодування (і чого він не вміє: запис файлів, запуск тестів):** наш цикл з ~250 рядків має лише 2 read-only інструменти (`list_files`, `read_file`) з перевіркою виходу за межі `root` та лімітом 64 КБ. Він **не вміє** створювати чи модифікувати файли у файловій системі (`write_file` / `patch`) і **не вміє** виконувати shell-команди (`npm test`, `npm run typecheck`), тому не може сам перевірити, чи компілюється запропонований ним код і чи проходять тести — ці дії мусить виконувати людина вручну після отримання JSON (наприклад, у сесії `agent-loop-ollama-chat-2026-11-15T08-00-27-892Z` модель згенерувала валідний за Zod JSON із імпортом `@/health` замість відносного шляху `../../../src/health`, що було виявлено лише під час ручного запуску `npm test` у гілці `lab1/health-loop`).
- **Звідки різниця у вхідних токенах:** LLM не має стану між викликами API, тому на кожному кроці `step` масив `messages` (усі попередні відповіді асистента, результати `read_file` та помилки схеми) пересилається заново. Через це за 2 кроки в `ollama-chat` сума вхідних токенів склала 1334 (з них 948 повернуто з префіксного KV-кешу), а за 12 кроків у `ollama-messages` той самий зростаючий контекст пересилався 12 разів поспіль і дав 9583 вхідних токени (8412 з кешу).

---

<!-- Файл: docs/lab1/model-decision.md -->

# Рішення про заміну моделі — Лабораторна 1

## 1. Яку заміну виконано і де саме в коді

- **До заміни:**
  1. У реєстрі ролей `src/models.ts` роль `cheap` вказує на `CATALOG['claude-haiku-4-5-20251001']` ($1.00 / $5.00 за 1 млн токенів, `retiresNotBefore: '2026-10-15'`).
  2. У скрипті `scripts/measure-loop.ts` та маршруті `app/api/agent/route.ts` хмарний режим за замовчуванням звертався до `CATALOG['gemini-3.8-flash']` ($0.75 / $3.75 за 1 млн токенів за промо-ціною до `2026-12-31`, після чого $1.50 / $7.50).
- **Після заміни:**
  - Робочою хмарною моделлю для агентного циклу (`scripts/measure-loop.ts`, рядок `const spec = CATALOG['gemini-3.5-flash-lite'];`) і серверного маршруту Vercel (`app/api/agent/route.ts`, рядок `model: google(CATALOG['gemini-3.5-flash-lite'].id)`) обрано **`CATALOG['gemini-3.5-flash-lite']`** ($0.30 / $2.50 за 1 млн токенів), а як безкоштовний резерв через шлюз OpenRouter — **`inclusionai/ling-3.2-flash:free`** ($0.00 / $0.00).
  - Для ролі `MODELS.cheap` у `src/models.ts` цільова заміна для курсової роботи — переприв'язка рядка:
    ```ts
    // До:
    cheap: CATALOG['claude-haiku-4-5-20251001'],
    // Після (для захисту курсової після 2026-10-15):
    cheap: CATALOG['gemini-3.5-flash-lite'],
    ```
    *(У поточному стані репозиторію Лабораторної 1 в `src/models.ts` залишено `claude-haiku-4-5-20251001`, оскільки базовий модульний тест `src/models.test.ts` прямо перевіряє `isRetiringBefore('cheap', '2027-06-20') === true` та `specFor('cheap').minCachePrefixTokens === 4096`).*

## 2. Порівняння показників «До» і «Після» за реальними прогонами

Усі цифри взяті з фактичних прогонів одного й того самого завдання (`/api/health` у `scripts/measure-loop.ts` та замірів `scripts/measure-cost.ts`):

| Показник | До (`gemini-3.8-flash`) | Після — хмара (`gemini-3.5-flash-lite`) | Після — шлюз (`inclusionai/ling-3.2-flash:free`) | Після — локально (`qwen3:4b`, `ollama-chat`) | Джерело / посилання на прогін |
|---|---:|---:|---:|---:|---|
| Вхідні токени (inputTokens) | 0 (помилка 503 у циклі) / 15 613 (у measure-cost) | **11 570** | **1 612** (кеш: 576) | **1 334** (кеш: 948) | [cost.md](./cost.md), [comparison.md](./comparison.md) |
| Вихідні токени (outputTokens) | 0 (у циклі) / 726 (у measure-cost) | **373** | **1 065** | **3 767** | [.agent-log/agent-loop.jsonl#L2-L16](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L2-L16) |
| Ціна за прайсом ($ за прогін) | $0.014432 (при .75 / .75 за 1M) | **$0.004404** (при .30 / .50 за 1M) | **$0.000000** (:free) | **$0.000000** (локально) | [cost.md#4-три-прогони-крок-11](./cost.md) |
| Фактично сплачено ($) | $0.000000 (Free Tier) | **$0.000000** (Free Tier) | **$0.000000** | **$0.000000** | [cost.md](./cost.md) |
| Затримка (мс) | 90 000 мс (таймаут / HTTP 503 у циклі; 504 на Vercel) | **8 169 мс** (у циклі з 11 кроків; ~1 747 мс на 1 виклик у Vercel) | **105 936 мс** (2 кроки) | **828 106 мс** (2 кроки на CPU; 3 251 089 мс у messages) | [.agent-log/agent-loop.jsonl#L4-L16](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L4-L16), [comparison.md](./comparison.md) |
| Якість (валідні виходи за схемою Zod Proposal) | **0 з 1** (HTTP 503 UNAVAILABLE) | **1 з 1** (done) | **1 з 1** (done) | **1 з 1** у ollama-chat (done); **0 з 2** у ollama-messages (max-steps) | [comparison.md#10-прогонів-валідація-схеми](./comparison.md) |

## 3. Чому виконано заміну

1. **Відмова в обслуговуванні (`HTTP 503` та `504 FUNCTION_INVOCATION_TIMEOUT`):** під час виконання кроків 08–10 модель `gemini-3.8-flash` систематично повертала `503 UNAVAILABLE (This model is currently experiencing high demand)` або закривала з'єднання через 10+ секунд, що призводило до перевищення 60-секундного ліміту серверної функції Vercel Hobby (`504`). Перехід на `gemini-3.5-flash-lite` скоротив час повного агентного циклу до **8,17 с** (`8169 мс`), а одиничного виклику `/api/agent` — до **1,75 с** зі 100% успішністю (`3 з 3` трас у Langfuse та `1 з 1` за схемою Zod).
2. **Економія за прайсом у 2,5–3,3 раза:** базовий тариф `gemini-3.5-flash-lite` становить **$0.30 / $2.50** за 1 млн токенів проти **$0.75 / $3.75** (промо) і **$1.50 / $7.50** (базовий після `2026-12-31`) у `gemini-3.8-flash` та **$1.00 / $5.00** у `claude-haiku-4-5-20251001`. На одному прогоні циклу з 11 570 вхідних і 373 вихідних токенів вартість за прайсом становить лише **$0.004404**.
3. **Непридатність локальної моделі без дискретного GPU для інтерактивного деплою:** локальна `qwen3:4b` на ноутбуці без GPU витрачає **828,1 с (~13,8 хв)** у режимі `ollama-chat` і **3251,1 с (~54,2 хв)** у режимі `ollama-messages` через примусову генерацію блоків `<think>`, а також не може викликатися з хмарного контейнера Vercel.

## 4. Ризики обраної моделі та як вони враховані

1. **Горизонт життєвого циклу (`retiresNotBefore`):**
   - Модель `claude-haiku-4-5-20251001` у `MODELS.cheap` має `retiresNotBefore: '2026-10-15'` (`isRetiringBefore('cheap', '2026-11-15') === true`), тобто дата гарантованої підтримки вже минула до моменту захисту.
   - Для `gemini-3.5-flash-lite` у `CATALOG` поле `retiresNotBefore` не оголошене (`undefined`), що означає відсутність анонсованої дати зняття з підтримки на сторінці Google Gemini API, але вимагає періодичної перевірки сторінки deprecations перед захистом курсової.
2. **Політика конфіденційності даних безкоштовного рівня (Free Tier Data Policy):**
   - На безкоштовному тарифі (Unpaid / Free tier) Google AI Studio та `:free`-моделей OpenRouter провайдери залишають за собою право використовувати промпти і відповіді для навчання та покращення моделей (відповідно до Terms of Service Google Gemini API для Unpaid Services та налаштувань Privacy в OpenRouter).
   - Саме тому в проєкті на рівні коду та хуків (`scripts/guard-env.mjs`, `.opencode/plugins/guard-env.js`, `.github/hooks/guard-env.json`) заблоковано читання й передачу файлів `.env*` та секретних ключів у контекст моделі.

---

<!-- Файл: docs/lab1/autonomy-log.md -->

# Журнал автономності — Лабораторна 1

Сесія — одна цілісна робота з агентом над однією задачею: від запуску до коміту або відмови.

| Дата | Інструмент і модель | Режим дозволів | Рівень довіри (L0–L5) | Задача | Що запропонував / що виконав | Де і чому я втрутився | Які докази прийняв | Журнал / коміт |
|---|---|---|---|---|---|---|---|---|
| 22.10.2026 | OpenCode 1.19.3, qwen3:4b | Manual | L0 | Перший запуск: «Які команди перевірки є в цьому репозиторії?» | Прочитав package.json, склав таблицю скриптів та додав вимоги з AGENTS.md | Не втручався | звірив відповідь із package.json | hooks ще немає (крок 02) |
| 22.10.2026 | GitHub Copilot CLI 1.0.98 | Manual | L0 | Перший запуск: «Які команди перевірки є в цьому репозиторії?» | Прочитав package.json (43 рядки), перелічив скрипти (test, typecheck, lint, build, e2e) | Змінив команду з explain на -p через відсутність підкоманди | звірив відповідь із package.json | hooks ще немає (крок 02) |
| 14.11.2026 | OpenCode, big-pickle | Plan (`--agent plan`) -> Build (`--agent build`) | L2 | Реалізація ендпоінта `GET /api/health` за контрактом `src/health.ts` і `tests/health.test.ts` | У режимі плану перевірив `tsconfig.json` і `vitest.config.ts`, запропонував відносний імпорт `../../../src/health`; після схвалення створив `app/api/health/route.ts` і прогнав перевірки | Налаштував `opencode.json` для заборони `bash`/`edit` у режимі плану; перевірив відсутність змін у контрактах та динамічний статус маршруту `ƒ /api/health` | `npm run typecheck`, `npm test` (60/60), `npm run lint`, `npm run build` (`ƒ /api/health`), порожній `git diff` контракту | `.agent-log/opencode.jsonl` (`ses_e26265198ffeXPIDS4pE8LROnY`), коміт `06e5795` |
| 14.11.2026 | GitHub Copilot CLI, GPT-6 Luna | `/plan` -> `--allow-all-tools` | L2 | Реалізація ендпоінта `GET /api/health` за контрактом `src/health.ts` і `tests/health.test.ts` | У плані прочитав лише 3 файли і запропонував вузький тест; у реалізації створив `app/api/health/route.ts` без імпорту `HealthResponse` і прогнав 4 команди перевірки | Не втручався у код гілки, але при виборі гілки для злиття в `main` відхилив варіант Copilot на користь OpenCode через відсутність типізації `HealthResponse` | Ручний запуск `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` та порівняння `git diff` між гілками | `.agent-log/copilot.jsonl` (`9546a6bb-e7a4-41f8-8145-7ff68aa1bccb`), коміт `f043db2` |
| 14.11.2026 | OpenCode (`big-pickle`) + GitHub Copilot CLI (`GPT-6 Luna`, `MAI-Code-1.1-Flash`) | `--agent plan` (OpenCode), `-p "/plan ..." --allow-all-tools` (Copilot) | L1 | Створення навички `add-api-route` та тест на спрацювання (6 запитів × 2 інструменти) | Обидва інструменти взяли навичку `add-api-route` на всіх 3 позитивних запитах і проігнорували на всіх 3 негативних (12/12); Copilot попри `/plan` із `--allow-all-tools` почав створювати/редагувати файли та запускати `check-route.mjs` | Після кожного запиту відкочував створені чи змінені файли командами `git restore -- app src tests` і `git clean -fd -- app src tests`, залишивши лише записи в `.agent-log/` | Ручна перевірка `check-route.mjs health` (код 0) і `version` (код 1), `npm run sync-skills -- --check`, рядки `"tool":"skill"` у `.agent-log/*.jsonl` | `.agent-log/opencode.jsonl` (`L21–L83`), `.agent-log/copilot.jsonl` (`L12–L78`), `docs/lab1/skill-trigger.md` |
| 14.11.2026 | OpenCode (`big-pickle`) + GitHub Copilot CLI (`GPT-6 Luna`) | `--agent build` з `.opencode/plugins/guard-env.js` та `preToolUse` `scripts/guard-env.mjs` | L2 | Заборона доступу до `.env*` (3 способи запису в бою) та підключення й вимір MCP Context7 | На свіжій сесії обидва агенти зупинилися на Шарі 1 (порада в `AGENTS.md`); під час прямої перевірки Шару 3 (pre-hook / плагін) усі 3 способи (`write`/`apply_patch`, `echo >> .env`, `node -e fs.appendFileSync`) заблоковано з маскуванням `TEST_KEY=***` і записом `"result":"denied"` у журнал; через MCP Context7 обидва знайшли документацію Next.js App Router `route.ts` | Розширив розбір `apply_patch` у `scripts/guard-env.mjs`, щоб ловити патчі Copilot CLI; перевірив відсутність `.env` (`Test-Path .env = False`). Обмеження Шару 3 на Windows без WSL2: текстовий регулярний вираз у hook не зловить обхід через кодування назви файлу в Base64 (`Buffer.from('LmVudg==','base64')`), конкатенацію рядків `'.e'+'nv'` або окремий скрипт без підрядка `.env` у команді | 6 рядків `"result":"denied"` (`opencode.jsonl#L85-L87`, `copilot.jsonl#L79-L81`), `Test-Path .env = False`, виклики `context7` (`opencode.jsonl#L88-L89`, `copilot.jsonl#L82-L83`) | `.agent-log/opencode.jsonl` (`L85–L89`), `.agent-log/copilot.jsonl` (`L79–L83`), коміт `1dc2d798804148785d239a54e6f2350c7e782463` |

| 14.11.2026 | OpenCode (big-pickle) | `--agent build` | L2 | Крок 06: додавання посилання «Стан сервісу» на `/api/health` на головній та E2E-тест Playwright | Оновив `app/page.tsx` (додав посилання на `/api/health`), створив `tests/home-health-link.spec.ts`, прогнав `npm run e2e` (`2 passed`) | Перевірив скріншот `home-health-link.png`, прогін CI `https://github.com/ArtuR188/Agent-Engineering/actions/runs/43612293740` та скопіював артефакт у `docs/lab1/e2e-home.png` | `npm run e2e` (`2 passed`), скріншот `home-health-link.png` з посиланням «Стан сервісу», зелений job `Playwright (не блокує)` у CI #19 | `.agent-log/opencode.jsonl`, коміт `1681ba2`, `docs/lab1/e2e-home.png` |
## Мова артефактів

Для `AGENTS.md` та `SKILL.md` (`add-api-route`) обрано українську мову, оскільки всі контрольні запити лабораторної формулюються українською. Хоча кириличний текст споживає більше токенів за англійський (точний множник `ua / en` вимірюється на кроці 07 у `docs/lab1/cost.md`), прямий збіг термінології в `description` навички («ендпоінт», «API-маршрут», «обробник HTTP-запиту») з мовою промптів забезпечив 12 із 12 точних спрацювань маршрутизатора навичок в обох інструментах.
## Крок 07 — Облік вартості, кеш і множник мов (2026-11-14)
- Створено `src/cost.ts`, `tests/cost.test.ts` (14 тестів, загалом 74/74 зелені у `npm test`), `scripts/measure-cost.ts` та звіт `docs/lab1/cost.md`.
- Перевірка `npm run typecheck` (`tsc --noEmit`) пройдена без помилок.
- Звірка оцінки входу (`gemini-3.8-flash`): `countTokens` = `15613`, факт `promptTokenCount` = `15613`, похибка `0.0%` (`≤ 10%`), кеш `13360` токенів на другому виклику.
- Кеш `ollama` (`qwen3:4b`, `0.40.13`): `ollama-1` (`1963` вхідних, `0` кешованих), `ollama-2` (`1963` вхідних, `1962` кешованих, `cache_read_input_tokens`).
- Множник `ua / en` (36 слів): `google · gemini-3.8-flash` = `1.73` (`78 / 45`), `ollama · qwen3:4b` = `2.75` (`121 / 44`).

## Крок 08 — Власний агентний цикл і порівняння двох форм API (2026-11-15)

| Дата | Інструмент і модель | Режим | Рівень | Задача | Що зробив агент | Де втрутились і чому | Як перевірили | Доказ (лог / коміт) |
|---|---|---|---|---|---|---|---|---|
| 15.11.2026 | Власний цикл (`runAgentLoop`), `qwen3:4b` (Ollama Messages & Chat Completions) | Автономний цикл (`maxSteps: 12`, read-only tools) | L1 | Реалізація `GET /api/health` за контрактом `src/health.ts` і `tests/health.test.ts` (пропозиція JSON за схемою Zod) | У `ollama-chat` за 2 кроки викликав `read_file` для `src/health.ts` і `tests/health.test.ts` та повернув валідний JSON за схемою `Proposal` (`done`, 1334 вхідних, 948 кешованих, 3767 вихідних токенів, 828.11 с) | У `ollama-messages` модель впиралася в `max-steps` (12 кроків, 24184 вихідні токени) через примусовий блок `<think>` на CPU; усунено виставленням `maxTokens: 2048` і прямою вказівкою читати файли контракту. Оскільки цикл не має інструментів запису й запуску тестів, вручну виправлено шлях імпорту `../../../src/health` у гілці `lab1/health-loop` | `npm test` (88/88 у `main`, 60/60 у `lab1/health-loop`), `npm run typecheck`, `npm run lint`, валідація Zod-схеми `Proposal` | `.agent-log/agent-loop.jsonl` (`agent-loop-ollama-chat-2026-11-15T08-00-27-892Z`, `agent-loop-ollama-messages-2026-11-14T20-41-51-032Z`), гілка `lab1/health-loop` (коміт `a9eb659`), `docs/lab1/comparison.md` |

- **Реалізовано:** `src/agent/agent-loop.ts` (`runAgentLoop`), `src/agent/tools.ts` (`createTools`, `jsonlLogger`), `src/agent/adapters.ts` (`messagesModel`, `chatCompletionsModel`), `scripts/measure-loop.ts`, `tests/agent-loop.test.ts` (14 модульних тестів циклу, інструментів і обох форм API).
- **Прогони та діагностика:** досліджено поведінку локальної моделі `qwen3:4b` на CPU у двох формах API (`Messages` і `Chat Completions`). Виявлено, що примусовий блок `<think>` у шаблоні моделі призводить до зупинки `max-steps` (12 кроків, 24 184 вихідні токени, сесія `agent-loop-ollama-messages-2026-11-14T20-41-51-032Z`), якщо модель не вкладається у `max_tokens`. Після налаштування промпту й ліміту токенів у `ollama-chat` (резерв замість `gemini`, який повертав HTTP 503 / timeout) отримано валідний вихід `done` за 2 кроки (2 виклики `read_file`, 1334 вхідних, 948 кешованих, 3767 вихідних токенів, 828,11 с, сесія `agent-loop-ollama-chat-2026-11-15T08-00-27-892Z`).
- **Верифікація:** пропозицію застосовано у чистій гілці `lab1/health-loop` від базового коміту `dded157` (коміт `a9eb659`), `tests/health.test.ts` проходить, результати зафіксовано у `docs/lab1/comparison.md` та `.agent-log/agent-loop.jsonl`.

## Крок 09 — Перенесення агентного циклу на AI SDK 7 і драбина довіри в коді (2026-11-15)

| Дата | Інструмент і модель | Режим | Рівень | Задача | Що зробив агент | Де втрутились і чому | Як перевірили | Доказ (лог / коміт) |
|---|---|---|---|---|---|---|---|---|
| 15.11.2026 | AI SDK 7 (`ai@7.0.173`, `ToolLoopAgent`), `MockLanguageModelV4` / `gemini-3.8-flash` | Двоетапне підтвердження (`toolApproval: { write_file: "user-approval" }`) | L1 | Перенесення циклу на `ToolLoopAgent` із деструктивним інструментом `write_file` та гейтом підтвердження людини | Перший `agent.generate()` зупиняється перед виконанням `write_file`, виводячи запит `Дозволити write_file {"path":"notes.txt","content":"hi"}? (y/n)`; виконує запис лише при `approved: true` | Перевірено мутацією: без рядка `toolApproval: { write_file: "user-approval" }` обидва випадки першого тесту червоніють (`2 failed`). При живому запуску на `gemini-3.8-flash` перший крок згенерував `tool-approval-request`, а при відхиленні файл `notes.txt` не було створено (`Test-Path notes.txt = False`) | `npm test` (91/91 зелений, включно з `tests/agent-aisdk.test.ts`), мутаційний тест `toolApproval`, `npm run typecheck`, `npm run lint` | `src/agent/agent-aisdk.ts`, `tests/agent-aisdk.test.ts`, `docs/lab1/comparison.md` |

## Крок 10 — Деплой обробника /api/agent на Vercel із трасуванням OpenTelemetry у Langfuse (2026-11-15)

| Дата | Інструмент і модель | Режим | Рівень | Задача | Що зробив агент | Де втрутились і чому | Як перевірили | Доказ (лог / коміт) |
|---|---|---|---|---|---|---|---|---|
| 15.11.2026 | Next.js 16 Route Handler (`/api/agent`), AI SDK 7 (`ToolLoopAgent`), `@langfuse/otel`, `@langfuse/vercel-ai-sdk`, `gemini-3.5-flash-lite` | Serverless на Vercel Hobby + OpenTelemetry (`exportMode: "immediate"`) | L2 | Деплой публічного маршруту `/api/agent` з інструментом `getTime` та збором трас у Langfuse Cloud | Виконує до 3 кроків (`isStepCount(3)`), викликає `getTime` для запитів про час і гарантовано відправляє спани через `after(() => langfuseSpanProcessor.forceFlush())` | 1) Усунено конфлікт peerDependencies `ERESOLVE` встановленням сумісної версії `@opentelemetry/sdk-node@^0.200.0`. 2) Оскільки `gemini-3.8-flash` віддавала `503 / timeout`, маршрут перемкнуто на доступну модель із каталогу `CATALOG["gemini-3.5-flash-lite"]`, а в `src/otel/langfuse.ts` додано очищення змінних середовища від випадкових лапок | 3 успішні POST-запити до `https://agent-engineering-kappa.vercel.app/api/agent` (отримано `usage` і 3 траси `lab01-agent` у Langfuse зі скріншотами в `docs/lab1/traces/`) | `instrumentation.ts`, `instrumentation.node.ts`, `src/otel/langfuse.ts`, `app/api/agent/route.ts`, `docs/lab1/traces/`, `docs/lab1/README.md` |

## Крок 11 — Пакет доказів, порівняння трьох провайдерів (Gemini, OpenRouter, Ollama) та обґрунтування мови артефактів (2026-11-15)

| Дата | Інструмент і модель | Режим | Рівень | Задача | Що зробив агент | Де втрутились і чому | Як перевірили | Доказ (лог / коміт) |
|---|---|---|---|---|---|---|---|---|
| 15.11.2026 | Власний цикл scripts/measure-loop.ts (gemini-3.5-flash-lite, inclusionai/ling-3.2-flash:free, qwen3:4b) | Read-only інструменти (list_files, ead_file) + Zod Proposal | L1 | Порівняльний прогін 3 провайдерів (хмара, шлюз OpenRouter, локальна Ollama) з однаковим входом та збір пакета доказів | Виконав задачу /api/health на всіх 3 провайдерах (done за 11 кроків у Gemini за 8,17 с; done за 2 кроки в OpenRouter за 105,9 с; done за 2 кроки в ollama-chat за 828,1 с) | Додано гілку openrouter у scripts/measure-loop.ts; через HTTP 503 на gemini-3.8-flash виконано й задокументовано заміну на gemini-3.5-flash-lite у docs/lab1/model-decision.md | 
pm run typecheck, 
pm run lint, 
pm test (91/91), 
pm run build, перевірка відсутності ключів у git-історії | [.agent-log/agent-loop.jsonl#L1-L16](https://github.com/ArtuR188/Agent-Engineering/blob/6b259e494d23ca96968f56f94d190c3a61f67370/.agent-log/agent-loop.jsonl#L1-L16), [docs/lab1/cost.md](./cost.md), [docs/lab1/model-decision.md](./model-decision.md) |

### Обґрунтування мови артефактів (множник токенів `ua / en` з кроку 07)
- За результатами вимірювання `npx tsx --env-file=.env.local scripts/measure-cost.ts lang docs/lab1/cost.md` на ідентичному правилі з 36 слів множник токенізації українського тексту відносно англійського становить **`1.73x`** для `gemini-3.8-flash` (`78` токенів `ua` проти `45` токенів `en`) та **`2.75x`** для локальної моделі `qwen3:4b` в Ollama (`121` токен `ua` проти `44` токенів `en`).
- **Висновок для інженерії контексту:** системні інструкції (`AGENTS.md`, `SKILL.md`), які автоматично підвантажуються на кожному кроці агентного циклу, доцільно тримати максимально стислими (≤ 40 рядків, див. `docs/lab1/agents-md-40.md`) або формулювати англійською у високонавантажених циклах із локальними моделями (де кирилиця збільшує обсяг вхідного контексту і час prefill у 2,75 раза), тоді як звіти й документацію для людини (`docs/lab1/*.md`) вести українською мовою.

---

<!-- Файл: docs/lab1/intro-draft.md -->

# Чернетка «Вступу» курсової роботи

## Тема проєкту
**Багатоагентна система автоматизованого рефакторингу програмного коду з контекстним забезпеченням на основі графів знань AST порівняно з векторним RAG**

## 1. Яку систему на агентах планується розробити
Планується розробити багатоагентну систему для автоматизованого виявлення структурних запахів коду (code smells) та безпечного рефакторингу модулів мовою Python (3.12+) із верифікацією результатів модульними тестами `pytest`. Оркестрація побудована як керований цикл агентів із чітким розподілом ролей та рівнів доступу до інструментів:
1. **Агент-аналізатор (Planner / Analyzer, рівень L1 — лише читання):** будує та опитує граф знань абстрактного синтаксичного дерева (AST Knowledge Graph: вузли функцій, класів, імпортів і ребра викликів `calls` / залежностей `imports`) або векторне сховище (ChromaDB) для збору мінімально достатнього контексту залежних символів.
2. **Агент-трансформатор (Refactorer, рівень L2 — генерація патчу за схемою):** приймає знайдений підграф залежностей і генерує структуровану пропозицію змін (JSON/diff за суворою Zod/Pydantic-схемою) без прямого доступу до оболонки ОС.
3. **Агент-верифікатор (Verifier / Executor, рівень L2 з ізольованим контейнером):** застосовує запропонований патч в ізольованому середовищі, запускає статичну перевірку типів, лінтер і набір тестів `pytest`. Якщо тести падають, повертає трасу помилки агенту-трансформатору (з жорстким лімітом `maxSteps` та `tokenBudget`), а після перевищення ліміту відкочує зміни.

## 2. Для кого призначена система
- **Розробники ПЗ та команди супроводу легасі-проєктів (B2B / внутрішні інженерні команди):** для автоматизації рутинного рефакторингу (декомпозиція довгих методів, усунення дублювання, оновлення сигнатур) зі збереженням проходження тестів і контролем людини перед злиттям (`user-approval` / Pull Request).
- **Дослідники та інженери агентних систем:** як відтворюваний стенд (бенчмарк) для кількісного порівняння двох архітектур подачі контексту коду в агентний цикл — структурного графа AST проти стандартного векторного пошуку (RAG) за метриками частки проходження тестів (`Pass@1`), вартості у токенах/доларах та затримки.

## 3. Яку проблему вона розв'язує
Сучасні LLM-агенти при рефакторингу реальних репозиторіїв стикаються з компромісом між **повнотою контексту** та **вартістю й точністю**:
- Повне завантаження всіх файлів репозиторію у промпт швидко вичерпує бюджет токенів і погіршує увагу моделі («lost in the middle»).
- Класичний векторний RAG (розбиття коду на текстові чанки за косинусною подібністю ембедингів) знаходить лексично схожі фрагменти, але часто пропускає **структурні залежності** (хто викликає змінювану функцію, які класи наслідують інтерфейс, які модулі імпортують символ), що призводить до синтаксично правдоподібного коду, який ламає сусідні модулі під час запуску тестів.
- Запропонована система розв'язує цю проблему за рахунок заміни (або доповнення) векторного пошуку детермінованим обходом графа AST у поєднанні з жорсткими брамами верифікації (ліміти кроків і бюджету токенів, валідація схеми виходу та обов'язковий прогін автотестів перед підтвердженням людиною).
