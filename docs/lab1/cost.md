# Вартість викликів — Лабораторна 1

Ollama: `0.40.13` (`qwen3:4b`) · дата вимірів: `2026-11-14`

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
