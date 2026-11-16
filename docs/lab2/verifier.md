# Верифікатор (крос-модельна брама) — Крок 03

Дата: 2026-11-16

## 1. Конфігурація верифікатора та усунення self-preference bias

| Параметр | Автор коду / основний агент | Верифікатор (суддя) |
|---|---|---|
| Провайдер / шлюз | Google AI Studio (`@ai-sdk/google`) | OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) |
| Родина моделей | Google Gemini | DeepSeek |
| Ідентифікатор моделі | `gemini-3.5-flash-lite` | `deepseek/deepseek-v4.1-flash` (`VERIFIER_MODEL`) |
| Параметри виклику | `temperature: 0` | `temperature: 0`, `max_tokens: 4096`, `reasoning: { effort: "low" }` |
| Точка входу | `src/agent/agent-loop.ts` | `scripts/verify.ts` (`npm run verify`) + `.github/workflows/verify-gate.yml` |

## 2. Схема вердикту та рубрика за критеріями приймання (`docs/lab2/spec.md`)

- Схема Zod (`src/verify/schema.ts`, `.strict()` + `.superRefine()`): `id` (`A1`–`A6`), `verdict` (`pass | fail | unknown`), `reason`, `evidence` (непорожній для `pass`/`fail`, порожній `""` для `unknown`).
- Блокування (`isBlocked`): будь-який `fail` завершує `scripts/verify.ts` із кодом `1`; `unknown` не блокує за відсутності `fail`.
- Санітизація (`sanitizeDiff`): видаляє `.env*` та маскує `*_API_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `Bearer`.

## 3. Калібрування на 10 реальних випадках

Ручна розмітка (`manualVerdict`) зафіксована у `scripts/calibrate-verifier.ts` до запуску судді. Траса: `docs/lab2/traces/calibration-report.json`.

| # | Випадок (diff / зміна) | Критерій | Ручний вердикт | Вердикт судді | Збіг | Пояснення судді (`deepseek/deepseek-v4.1-flash`) |
|---|---|---|---|---|---|---|
| 1 | Коміт 9415544: додано docs/lab2/spec.md (лише спека) | `A1` | `unknown` | `unknown` | Так | Зміна містить лише новий файл документації docs/lab2/spec.md з описом критерію, але немає жодних доказів фактичного прогону npm test/typecheck/lint/build чи результатів CI. |
| 2 | Коміт 9bced4d: додано validate-golden.ts з порогом 20 і 20 запитів у queries.jsonl | `A2` | `pass` | `pass` | Так | Зміна додає у docs/lab2/golden/queries.jsonl записи від q-01 до q-20 (20 запитів), а у валідаторі встановлено поріг SUBMIT total:20, що відповідає критерію ≥20 запитів. |
| 3 | Неповний diff 9bced4d: змінено лише tests/validate-golden.test.ts без queries.jsonl | `A2` | `unknown` | `unknown` | Так | Зміна додає лише тривіальний тест у tests/validate-golden.test.ts і не містить жодних даних про вміст docs/lab2/golden/queries.jsonl чи результат роботи валідатора. |
| 4 | Дефектний diff: у queries.jsonl лише 5 запитів замість ≥ 20 | `A2` | `fail` | `fail` | Так | У зміні додано лише 5 запитів (q-01…q-05), що менше обовʼязкових 20, тому критерій кількості не виконано. Доказів проходження валідатора також немає. |
| 5 | Коміт 61ac0ef: додано baseline.md без згадки git log або .agent-log | `A3` | `unknown` | `unknown` | Так | Надана зміна містить лише додавання docs/lab2/baseline.md і не показує історію комітів для docs/lab2/spec.md чи вміст .agent-log/*.jsonl. |
| 6 | Лог перевірки A3: git log показує 9415544 до 9bced4d, пошук у .agent-log/*.jsonl дав 0 збігів | `A3` | `pass` | `unknown` | **Ні** | Зміна містить лише файл audit-a3.txt із самостійно задекларованими результатами git log та Select-String, але не містить самого spec.md, історії комітів або вмісту .agent-log для незалежної перевірки. |
| 7 | Дефектний лог A3: у .agent-log/opencode.jsonl є tool=edit для docs/lab2/spec.md | `A3` | `fail` | `fail` | Так | У зміні додано запис редагування `docs/lab2/spec.md` у лог агента, що прямо порушує вимогу відсутності таких записів у `.agent-log/*.jsonl`. |
| 8 | Крок 03 без verifier.md: є scripts/verify.ts і verify-gate.yml, але docs/lab2/verifier.md відсутній | `A4` | `fail` | `fail` | Так | У наданій зміні відсутні обовʼязкові докази: немає запису в docs/lab2/verifier.md і немає тестів верифікатора, які б підтверджували зупинку злиття через знайдену помилку. Додано лише заглушку runVerify та workflow-крок npm run verify. |
| 9 | Крок 03 з docs/lab2/verifier.md (зафіксовано стоп злиття) і tests/verify.test.ts | `A4` | `pass` | `fail` | **Ні** | Зміна містить лише текстове твердження в docs/lab2/verifier.md та порожній тестовий блок, без фактичного коду верифікатора чи тесту, який підтверджує зупинку злиття через знайдену помилку. |
| 10 | Дефектний CI workflow: з verify-gate.yml видалено npm test і npm run build | `A1` | `fail` | `fail` | Так | Зміна видаляє кроки `npm test` та `npm run build` з CI-воркфлоу, тому критерій проходження всіх чотирьох команд у CI більше не виконується. |

**Підсумок калібрування:** збіг **8/10 (80%)**, кількість `unknown` — **4**.

### Аналіз розбіжностей і коригування системного промпту
1. **Випадок #6 (`manual=pass`, `judge=unknown`):** Суддя трактував текстовий звіт без метаданих Git як недостатній доказ (`unknown`).
2. **Випадок #9 (`manual=pass`, `judge=fail`):** Суддя виявив відсутність SHA коміту та порожній `describe()` без `expect`.
3. **Коригування промпту в `scripts/verify.ts`:** Уточнено правила `pass`/`fail`/`unknown` у `evaluateSingleCriterion` (для `A4` вимагаються `docs/lab2/verifier.md` із SHA зупиненого коміту та тести в `tests/verify.test.ts` із `expect`), ліміт diff збільшено до `40_000` символів.

## 4. Зафіксований стоп злиття (`exit code 1`) та виправлення

- **Зупинений коміт:** `5c1c6e3` (`feat(lab2): add cross-model verifier gate and calibration runner (step 03 wip)`).
- **Причина зупинки:** У коміті `5c1c6e3` був відсутній `docs/lab2/verifier.md`. Верифікатор повернув `A4 | fail` і завершився з кодом `1` (`docs/lab2/traces/verify-initial.json`).
- **Виправлення:** Додано `docs/lab2/verifier.md` із SHA `5c1c6e3` та калібруванням, оновлено `docs/lab2/verify-input.diff` і повторно виконано `npm run verify` (`A4 | pass`, код виходу `0`, `docs/lab2/traces/verify-final.json`).
