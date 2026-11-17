# Лабораторна робота 2: RAG, Агенти та MCP-сервер

## 🛠 Інструменти та Моделі
- **Платформа**: Node.js v24.22.0, TypeScript
- **Бібліотеки**: AI SDK (^3.4.15), Zod, Vitest, `@modelcontextprotocol/server`
- **Моделі генерації**: 
  - `gemini-3.5-flash-lite` (масові RAG-запити, базова генерація)
  - `claude-3.5-sonnet` (для субагентів і планування)
- **Ембединги**: `gemini-embedding` (вектор розмірності 768)
- **Сховище**: Локальний індекс `data/index.json` (гібридний пошук: BM25 + Cosine Similarity)

## 📁 Пакет доказів (Навігація)
1. **[Специфікація (spec.md)](./spec.md)**
2. **[Еталонний набір (eval-set.md)](./eval-set.md)**
3. **[Базова лінія (baseline.md)](./baseline.md)**
4. **[Субагенти (subagents.md)](./subagents.md)**
5. **[Протокол верифікатора (verifier.md)](./verifier.md)**
6. **[Індексація (indexing.md)](./indexing.md)**
7. **[Пошук (retrieval.md)](./retrieval.md)**
8. **[Звіт оцінювання (eval-report.md)](./eval-report.md)**
9. **[Бюджет і Паралельність (budget.md)](./budget.md)**
10. **[Специфікація MCP (mcp-spec.md)](./mcp-spec.md)**
11. **[Інтеграція MCP (mcp-integration.md)](./mcp-integration.md)**
12. **[Журнал автономності (autonomy-log.md)](./autonomy-log.md)**
13. **[Траси (traces/)](./traces/)**

## 🔗 Ключові коміти та CI (Докази)
- **Зелений прогін CI на main**: [Успішний прогін GitHub Actions](https://github.com/ArtuR188/Agent-Engineering/actions/runs/44124579371)
- **Робота верифікатора (Крок 03)**: [Прогін, де верифікатор зупинив зміну](https://github.com/ArtuR188/Agent-Engineering/actions/runs/43973815638)
- **Специфікація MCP до коду (Крок 08)**: [Коміт mcp-spec.md](https://github.com/ArtuR188/Agent-Engineering/commit/db3b9e145bee7cd4ce84082869706e37f3d2dfc6)

## 🚀 Як відтворити роботу локально

### 1. Встановлення
```bash
npm install
```
*(Потрібен `.env.local` з `GEMINI_API_KEY`)*

### 2. Індексація колекції
```bash
npm run typecheck
npx tsx scripts/build-index.ts
```

### 3. Оцінювання пошуку
```bash
npx tsx --env-file=.env.local scripts/eval-run.ts docs/lab2/golden/queries.jsonl
npx tsx scripts/eval-run.ts --summary
```

### 4. Запуск MCP-сервера (stdio)
Через Inspector:
```bash
npx @modelcontextprotocol/inspector --cli npx tsx src/mcp/server.ts --protocol-era modern --method tools/list --format json
```
Виклик клієнта застосунку:
```bash
npx tsx scripts/mcp-demo.ts "батут"
```
