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
