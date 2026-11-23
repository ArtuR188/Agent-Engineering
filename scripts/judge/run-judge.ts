import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Label = 'pass' | 'fail' | 'unknown';

interface JudgeCase {
  case_id: string;
  artifact: string;
  dimension: string;
  mine: Label;
  reason: string;
  holdout: boolean;
}

interface JudgeVerdict {
  case_id: string;
  dimension: string;
  verdict: Label;
  reason: string;
  model: string;
  rubric: string;
  order: string;
  at: string;
}

const RUBRIC_PATH = process.argv[2] ?? 'docs/lab3/rubric-v1.md';
const OUT_PATH = process.argv[3] ?? 'docs/lab3/verdicts/judge-v1.jsonl';
const CASES_PATH = 'docs/lab3/judge-cases.jsonl';
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.JUDGE_MODEL || 'qwen3:4b';

function readText(p: string, maxChars = 4000): string {
  if (!existsSync(p)) return '(файл відсутній)';
  const s = readFileSync(p, 'utf8').trim();
  return s === '' ? '(порожній файл)' : s.slice(0, maxChars);
}

function extractSection(rubric: string, dimension: string): string {
  const marker = `## Вимір: ${dimension}`;
  const start = rubric.indexOf(marker);
  if (start === -1) return rubric;
  const next = rubric.indexOf('\n## Вимір:', start + marker.length);
  return (next === -1 ? rubric.slice(start) : rubric.slice(start, next)).trim();
}

function normalizeLabel(raw: unknown): Label {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'pass' || s === 'fail' || s === 'unknown') return s;
  return 'unknown';
}

async function judgeOne(c: JudgeCase, section: string): Promise<{ verdict: Label; reason: string }> {
  const runJson = readText(join(c.artifact, 'run.json'), 2500);
  const patchDiff = readText(join(c.artifact, 'patch.diff'), 3000);
  const outputTxt = readText(join(c.artifact, 'output.txt'), 1000);

  const prompt = [
    'Ти суворий незалежний суддя. Оціни артефакт ВИКЛЮЧНО за одним виміром із рубрики нижче.',
    'Поверни ТІЛЬКИ JSON формату {"verdict":"pass"|"fail"|"unknown","reason":"1 коротке речення українською"}.',
    '',
    '=== РУБРИКА ===',
    section,
    '',
    '=== АРТЕФАКТ ===',
    `Шлях: ${c.artifact}`,
    `--- run.json ---\n${runJson}`,
    `--- patch.diff ---\n${patchDiff}`,
    `--- output.txt ---\n${outputTxt}`,
  ].join('\n');

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0 },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(content) as { verdict?: unknown; reason?: unknown };
    return {
      verdict: normalizeLabel(parsed.verdict),
      reason: String(parsed.reason ?? '').trim() || 'без пояснення',
    };
  } catch {
    return { verdict: 'unknown', reason: `невалідний JSON від моделі: ${content.slice(0, 120)}` };
  }
}

async function main() {
  const rubric = readFileSync(RUBRIC_PATH, 'utf8');
  const cases: JudgeCase[] = readFileSync(CASES_PATH, 'utf8')
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as JudgeCase);

  const verdicts: JudgeVerdict[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i]!;
    const section = extractSection(rubric, c.dimension);
    const r = await judgeOne(c, section);
    const row: JudgeVerdict = {
      case_id: c.case_id,
      dimension: c.dimension,
      verdict: r.verdict,
      reason: r.reason,
      model: `ollama:${MODEL}`,
      rubric: RUBRIC_PATH,
      order: 'single',
      at: new Date().toISOString(),
    };
    verdicts.push(row);
    console.log(`[${i + 1}/${cases.length}] ${c.case_id} ${c.dimension}: judge=${r.verdict} (mine=${c.mine})`);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, verdicts.map((v) => JSON.stringify(v)).join('\n') + '\n', 'utf8');
  console.log(`\nЗаписано ${verdicts.length} вердиктів у ${OUT_PATH}`);
}

main();