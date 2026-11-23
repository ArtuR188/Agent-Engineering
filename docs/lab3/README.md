# Лабораторна 3 — харнес автономних агентів

## 1. Таблиця прийняття

| Критерій | Де доказ | Посилання |
|---|---|---|
| брама · CI зелений на поданому SHA | автоматичний `gates.yml` на поданому `HEAD` гілки `main` (попередній зелений `main`: `45152675679` на `e92ff8b`) | [`gates.yml` на `main`](https://github.com/ArtuR188/Agent-Engineering/actions/workflows/gates.yml?query=branch%3Amain) · [run 45152675679](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45152675679) |
| брама · журнал автономності, ≥ 4 сесії | `docs/lab3/autonomy-log.md` (8 записів, коміти `2026-11-17`, `2026-11-22`, `2026-11-23`) | [autonomy-log.md](https://github.com/ArtuR188/Agent-Engineering/blob/f04f75d80208503eba3873052d1a494cb9c5d26d/docs/lab3/autonomy-log.md) |
| брама · жодного обходу перевірок дозволів | `.harness/config.json` (`permissionMode: dontAsk`, явний `allowedTools`; поле обходу прибрано в `dadd8f1`) + `src/harness/policy.ts` | [.harness/config.json](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/.harness/config.json) · [policy.ts](https://github.com/ArtuR188/Agent-Engineering/blob/457c0e2b375f9eb10b6703a26884c988ae721c8f/src/harness/policy.ts) |
| брама · немає секретів в історії | `git log --all --oneline -- .env .env.local` (порожньо); `git log -p --all -S "sk-"` / `AIzaSy` / `ghp_` / `pk-lf-` / `sk-lf-` — лише regex-санітизатори і тестовий мок `sk-secret-value`, реальних ключів немає | [policy.ts#L5](https://github.com/ArtuR188/Agent-Engineering/blob/457c0e2b375f9eb10b6703a26884c988ae721c8f/src/harness/policy.ts#L5) · [verify.ts](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/scripts/harness/verify.ts) |
| крок 00 · фабрика задач | `docs/lab3/factory.md` | [factory.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/factory.md) |
| крок 01 · ланцюг брам | `docs/lab3/gates.md` | [gates.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/gates.md) |
| крок 02 · верифікатор зупинив зміну | `docs/lab3/verifier.md` | [verifier.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/verifier.md) |
| крок 03 · прогін зупинився сам | `docs/lab3/stop.md` | [stop.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/stop.md) |
| крок 04 · регресійна брама в CI | `docs/lab3/evals.md` | [evals.md](https://github.com/ArtuR188/Agent-Engineering/blob/f04f75d80208503eba3873052d1a494cb9c5d26d/docs/lab3/evals.md) |
| крок 05 · число згоди судді | `docs/lab3/judge.md` | [judge.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/judge.md) |
| крок 06 · класифікація помилок | `docs/lab3/errors.md` + `docs/lab3/traces/` | [errors.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/errors.md) · [traces/](https://github.com/ArtuR188/Agent-Engineering/tree/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/traces) |
| крок 07 · ін'єкція промпту | `docs/lab3/redteam.md` + `docs/lab3/redteam.jsonl` | [redteam.md](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/redteam.md) · [redteam.jsonl](https://github.com/ArtuR188/Agent-Engineering/blob/53f54d8ef76caa14699c1280ab00031759a50ed3/docs/lab3/redteam.jsonl) |
| крок 08 · цей звіт | `docs/lab3/README.md` | [docs/lab3/README.md](./README.md) |

## 2. Прогони CI

- Зелений на поданому SHA гілки `main`: [`gates.yml` на `main`](https://github.com/ArtuR188/Agent-Engineering/actions/workflows/gates.yml?query=branch%3Amain) (тригер `push: branches: [main]` без `paths-ignore`, запускається автоматично на фінальному merge-коміті; останній повністю зелений прогін до Кроку 07: [`gates` #45152675679](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45152675679) на `e92ff8b`).
- Червоний, збережений як доказ #1 (реальна регресія `t-06` після посилення `policy.ts`): [run #45160055893 / job `evals`](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45160055893/job/137643755161) на коміті [`53f54d8`](https://github.com/ArtuR188/Agent-Engineering/commit/53f54d8ef76caa14699c1280ab00031759a50ed3) — що саме зупинило: регресійна брама `evals` зловила блокування `tests/dummy.test.ts` безумовним префіксом `tests/` → виправлення [`457c0e2`](https://github.com/ArtuR188/Agent-Engineering/commit/457c0e2b375f9eb10b6703a26884c988ae721c8f).
- Червоний, збережений як доказ #2 (контрольована регресія `evals`): [run #45069072666 / job `evals`](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45069072666/job/137352528919?pr=4) на коміті [`117ec77`](https://github.com/ArtuR188/Agent-Engineering/commit/117ec779ab8a90d390d195b174d569a09008554e) — що саме зупинило: поіменна брама `scripts/evals/gate.ts` → виправлення [`8555368`](https://github.com/ArtuR188/Agent-Engineering/commit/855536823e487899a517e54feb9ecf7e5ae19114) → зелений [run #45079416697](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45079416697/job/137384759605?pr=4).
- Червоний, збережений як доказ #3 (верифікатор `verify`): [run #45017118271 / job `verify`](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017118271/job/137192857151) на коміті [`e0fdc87`](https://github.com/ArtuR188/Agent-Engineering/commit/e0fdc8747ef64dc982f9719aef06aff10d139879) — що саме зупинило: LLM-верифікатор відхилив неповний патч → виправлення [`a99165c`](https://github.com/ArtuR188/Agent-Engineering/commit/a99165c4f7938a350d6efa8ef7da561ee69ca5ed) → зелений [run #45017732428](https://github.com/ArtuR188/Agent-Engineering/actions/runs/45017732428).

## 3. Інструменти й моделі

| Роль | Інструмент | Модель із версією | Платний чи безкоштовний шлях |
|---|---|---|---|
| Виконавець задач / evals / red-team | AI SDK (`ai@7.0.173`, `@ai-sdk/google@4.0.121`), `tsx@4.23.13`, Node `v24.22.0` | `gemini-3.5-flash-lite` | Безкоштовний (Google AI Studio Free Tier) |
| Верифікатор у CI (`verify`) | `scripts/harness/verify.ts` (`GEMINI_API_KEY` у GitHub Secrets) | `gemini-3.5-flash-lite` (замінила `gemini-3.8-flash` через `503`/`429`) | Безкоштовний (Google AI Studio Free Tier) |
| Локальний суддя (крок 05) | Ollama + `scripts/judge/run-judge.ts` (`temperature: 0`, `think: false`) | `ollama:qwen3:4b` (`9a59bb27fe92`) | Безкоштовний (локально, `$0`) |
| Телеметрія і трасування (кроки 06–07) | `@ai-sdk/otel@1.0.148`, `@opentelemetry/sdk-node@0.300.0`, `@opentelemetry/api@1.10.0`, `@opentelemetry/exporter-trace-otlp-http@0.300.0` | Langfuse Cloud EU (Hobby, OTLP/HTTP, `recordInputs/Outputs: false`) | Безкоштовний (Langfuse Hobby) |
| Детерміновані брами і CI | GitHub Actions (`gates.yml`, `factory.yml`), TypeScript `6.0.3`, ESLint `9.39.5`, Vitest `5.0.0`, Next.js `16.3.4` | Без LLM (детерміновані перевірки) | Безкоштовний (публічний репозиторій GitHub) |

## 4. Як повторити автономний прогін

1. **Підготовка середовища (Node `>= 22.12`, перевірено на `v24.22.0`):**
   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   # заповніть GEMINI_API_KEY (та за потреби LANGFUSE_* для експорту трас у Langfuse)
   ```
2. **Режим дозволів і перелік дозволених інструментів:**
   * Конфігурація `.harness/config.json`: `"permissionMode": "dontAsk"` (без прапорців обходу), явний `"allowedTools": ["readFile", "listFiles", "submitArtifact"]`.
   * У раннерах `scripts/evals/run-evals.ts` і `scripts/redteam/run-redteam.ts` доступні лише типізовані інструменти `readFile`, `writeFile`, `runChecks`, `submitArtifact` (без shell/git/network інструментів), захищені програмними межами `src/harness/policy.ts` (`assertReadAllowed`, `assertWriteAllowed`, `assertSafeOutput`).
3. **Спосіб ізоляції (`git worktree`):**
   * Кожна задача і кожен red-team сценарій запускаються в окремому чистому робочому дереві (`git worktree add -b ...`), яке примусово видаляється після збору `patch.diff` і `run.json`.
4. **Команди відтворення:**
   ```powershell
   # детерміновані брами + юніт-тести (158 тестів)
   npm run typecheck; npm run lint; npm test; npm run build

   # локальна перевірка регресійної брами проти замороженого банку (22 задачі)
   npx tsx scripts/evals/gate.ts

   # запуск одного прогону харнеса зі stopWhen / таймаутом / circuit breaker
   npm run harness -- --task t-04 --max-steps 6 --timeout-ms 60000

   # запуск 6 сценаріїв red-team у чистих git worktree
   $env:REDTEAM_PHASE = 'after'
   $env:REDTEAM_BASE_TASK = (Get-Content docs\lab3\tasks.jsonl -Encoding UTF8 -TotalCount 1)
   npx tsx scripts/redteam/run-redteam.ts
   ```
