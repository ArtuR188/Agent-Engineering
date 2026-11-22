import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { criterionVerdict, type CriterionVerdict } from '../../src/verify/schema';
import type { Label } from '../kappa';

const MODEL = process.env.VERIFIER_MODEL ?? 'gemini-3.5-flash-lite';

function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (existsSync('.env.local')) {
    const line = readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('GEMINI_API_KEY='));
    if (line) return line.slice('GEMINI_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  }
  throw new Error('GEMINI_API_KEY не знайдено у середовищі або .env.local');
}

interface CalibCase {
  num: number;
  taskId: string;
  taskInput: string;
  criterion: string;
  mine: Label;
  diff: string;
}

const CASES: CalibCase[] = [
  {
    num: 1,
    taskId: 't-01',
    taskInput: 'Виправ помилки типізації у файлі src/mcp/tools.ts, якщо вони є, та переконайся, що typecheck проходить.',
    criterion: 'type-error-fixed-in-tools-ts',
    mine: 'pass',
    diff: [
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -10,3 +10,3 @@',
      '-export function fetchChunk(id: number): string | null {',
      '+export function fetchChunk(id: string): string | null {',
    ].join('\n'),
  },
  {
    num: 2,
    taskId: 't-01',
    taskInput: 'Виправ помилки типізації у файлі src/mcp/tools.ts, якщо вони є, та переконайся, що typecheck проходить.',
    criterion: 'type-error-fixed-in-tools-ts',
    mine: 'fail',
    diff: [
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -10,2 +10,3 @@',
      '+// @ts-ignore',
      ' const badVar: string = 123;',
    ].join('\n'),
  },
  {
    num: 3,
    taskId: 't-02',
    taskInput: 'Додай JSDoc коментар до функції fetchChunk у src/mcp/tools.ts.',
    criterion: 'JSDoc-comment-added-to-fetchChunk',
    mine: 'pass',
    diff: [
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -12,1 +12,6 @@',
      '+/**',
      '+ * Отримує фрагмент за id.',
      '+ * @param id - Ідентифікатор фрагмента.',
      '+ * @returns Вміст або null.',
      '+ */',
      ' export function fetchChunk(id: string): string | null {',
    ].join('\n'),
  },
  {
    num: 4,
    taskId: 't-02',
    taskInput: 'Додай JSDoc коментар до функції fetchChunk у src/mcp/tools.ts.',
    criterion: 'JSDoc-comment-added-to-fetchChunk',
    mine: 'fail',
    diff: [
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -1,2 +1,3 @@',
      '+// TODO: check later',
      ' import fs from "node:fs";',
    ].join('\n'),
  },
  {
    num: 5,
    taskId: 't-03',
    taskInput: 'Перевір тести у tests/mcp.test.ts. Додай один тест на відмову при порожньому id для fetchChunk.',
    criterion: 'empty-id-edge-case-test-added',
    mine: 'pass',
    diff: [
      'diff --git a/tests/mcp.test.ts b/tests/mcp.test.ts',
      '--- a/tests/mcp.test.ts',
      '+++ b/tests/mcp.test.ts',
      '@@ -20,2 +20,6 @@',
      '+it("returns null on empty id", () => {',
      '+  expect(fetchChunk("")).toBeNull();',
      '+});',
    ].join('\n'),
  },
  {
    num: 6,
    taskId: 't-03',
    taskInput: 'Перевір тести у tests/mcp.test.ts. Додай один тест на відмову при порожньому id для fetchChunk.',
    criterion: 'empty-id-edge-case-test-added',
    mine: 'unknown',
    diff: [
      'diff --git a/tests/mcp.test.ts b/tests/mcp.test.ts',
      '--- a/tests/mcp.test.ts',
      '+++ b/tests/mcp.test.ts',
      '@@ -20,2 +20,3 @@',
      '+it("handles edge case", () => {',
      '+  // ... [diff truncated before assertion]',
    ].join('\n'),
  },
  {
    num: 7,
    taskId: 't-04',
    taskInput: 'Рефакторинг: винеси логіку читання файлу data/index.json з src/mcp/tools.ts у окрему утиліту src/mcp/utils.ts.',
    criterion: 'index-json-reading-extracted-to-utils',
    mine: 'pass',
    diff: [
      'diff --git a/src/mcp/utils.ts b/src/mcp/utils.ts',
      'new file mode 100644',
      '+++ b/src/mcp/utils.ts',
      '@@ -0,0 +1,4 @@',
      '+import { readFileSync } from "node:fs";',
      '+export function loadIndex() {',
      '+  return JSON.parse(readFileSync("data/index.json", "utf8"));',
      '+}',
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -1,3 +1,2 @@',
      '-import { readFileSync } from "node:fs";',
      '+import { loadIndex } from "./utils";',
    ].join('\n'),
  },
  {
    num: 8,
    taskId: 't-04',
    taskInput: 'Рефакторинг: винеси логіку читання файлу data/index.json з src/mcp/tools.ts у окрему утиліту src/mcp/utils.ts.',
    criterion: 'index-json-reading-extracted-to-utils',
    mine: 'unknown',
    diff: [
      'diff --git a/src/mcp/tools.ts b/src/mcp/tools.ts',
      '--- a/src/mcp/tools.ts',
      '+++ b/src/mcp/tools.ts',
      '@@ -1,3 +1,2 @@',
      '-import { readFileSync } from "node:fs";',
      '+import { loadIndex } from "./utils";',
    ].join('\n'),
  },
  {
    num: 9,
    taskId: 't-05',
    taskInput: 'Онови README.md в корені: додай секцію "MCP Server" з інструкцією запуску npx tsx src/mcp/server.ts.',
    criterion: 'readme-mcp-server-section-added',
    mine: 'pass',
    diff: [
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -40,1 +40,5 @@',
      '+## MCP Server',
      '+Запуск локального сервера:',
      '+```bash',
      '+npx tsx src/mcp/server.ts',
      '+```',
    ].join('\n'),
  },
  {
    num: 10,
    taskId: 't-06',
    taskInput: 'Створи простий тест tests/dummy.test.ts, який завжди проходить (expect(1).toBe(1)).',
    criterion: 'dummy-test-contains-expect-1-toBe-1',
    mine: 'fail',
    diff: [
      'diff --git a/tests/dummy.test.ts b/tests/dummy.test.ts',
      'new file mode 100644',
      '+++ b/tests/dummy.test.ts',
      '@@ -0,0 +1,3 @@',
      '+import { it } from "vitest";',
      '+it("dummy", () => {});',
    ].join('\n'),
  },
];

async function fetchWithRetry(url: string, body: string): Promise<Response> {
  const delays = [5000, 10000, 20000, 30000, 45000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body,
      });
      if (res.status === 429) {
        const bodyText = await res.clone().text();
        if (bodyText.includes('PerDay')) return res;
      }
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      if (i === delays.length) return res;
    } catch (err) {
      if (i === delays.length) throw err;
    }
    const ms = delays[i] ?? 15000;
    console.log(`  503/таймаут — повтор (${i + 1}/${delays.length}) через ${ms / 1000}с...`);
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error('fetchWithRetry failed');
}

async function judgeOne(apiKey: string, c: CalibCase): Promise<CriterionVerdict> {
  const prompt = [
    'Ти строгий верифікатор коду. Оціни ОДИН критерій приймання за описом задачі та git diff.',
    `Задача (${c.taskId}): ${c.taskInput}`,
    `Критерій (id): ${c.criterion}`,
    'Git diff:',
    c.diff,
    'Поверни ТІЛЬКИ валідний JSON-обʼєкт без markdown-обгортки:',
    '{"id":"<критерій дослівно>","verdict":"pass|fail|unknown","reason":"<1-2 речення>","evidence":"<цитата або файл:рядок>"}',
    'Правила схеми:',
    '- для "pass" і "fail" поле evidence ОБОВʼЯЗКОВО непорожнє;',
    '- для "unknown" поле evidence ОБОВʼЯЗКОВО порожній рядок "";',
    '- якщо даних у diff недостатньо для впевненого судження, став "unknown".',
  ].join('\n');

  const url =
    'https://' +
    'generativelanguage.googleapis.com/v1beta/models/' +
    MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetchWithRetry(url, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = raw.replace(/^`{3}json\s*/i, '').replace(/^`{3}\s*/i, '').replace(/`{3}$/i, '').trim();
    try {
      return criterionVerdict.parse(JSON.parse(cleaned));
    } catch (err) {
      if (attempt === 2) throw new Error(`Кейс #${c.num}: невалідний JSON після 2 спроб: ${String(err)}`);
    }
  }
  throw new Error('unreachable');
}

interface CalibRow {
  num: number;
  taskId: string;
  criterion: string;
  mine: Label;
  judge: Label;
  match: boolean;
  reason: string;
  evidence: string;
}

async function main() {
  const apiKey = loadApiKey();
  const outFile = 'docs/lab3/verdicts/calibration-10.json';
  mkdirSync('docs/lab3/verdicts', { recursive: true });

  const out: CalibRow[] = existsSync(outFile) ? (JSON.parse(readFileSync(outFile, 'utf8')) as CalibRow[]) : [];

  for (const c of CASES) {
    if (out.some((x) => x.num === c.num)) {
      console.log(`#${c.num} [${c.taskId}] вже пораховано — пропуск`);
      continue;
    }
    const v = await judgeOne(apiKey, c);
    const match = c.mine === v.verdict;
    out.push({
      num: c.num,
      taskId: c.taskId,
      criterion: c.criterion,
      mine: c.mine,
      judge: v.verdict,
      match,
      reason: v.reason,
      evidence: v.evidence,
    });
    out.sort((a, b) => a.num - b.num);
    writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log(`#${c.num} [${c.taskId}] mine=${c.mine} | judge=${v.verdict} | match=${match ? 'YES' : 'NO'} — ${v.reason}`);
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`Готово: ${outFile} (${out.length}/10)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});