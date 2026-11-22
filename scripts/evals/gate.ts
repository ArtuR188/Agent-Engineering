import { readFileSync, writeFileSync } from 'node:fs';

type Line = { task_id: string; bucket: string; frozen_at: string; pass: boolean };
type Baseline = Record<string, { pow_k: number; k: number; frozen_at: string }>;

const K = Math.max(1, Number(process.env.EVAL_K ?? 1));
const lines: Line[] = readFileSync('docs/lab3/evals.jsonl', 'utf8')
  .replace(/^\ufeff/, '')
  .split(/\r?\n/)
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as Line);

if (lines.length === 0) {
  console.error('docs/lab3/evals.jsonl порожній');
  process.exit(1);
}

const now = new Map<string, { bucket: string; frozen_at: string; ok: number; n: number }>();
for (const l of lines) {
  const c = now.get(l.task_id) ?? { bucket: l.bucket, frozen_at: l.frozen_at, ok: 0, n: 0 };
  now.set(l.task_id, { ...c, ok: c.ok + (l.pass ? 1 : 0), n: c.n + 1 });
}

const frozen = new Set([...now.values()].map((c) => c.frozen_at));
if (frozen.size !== 1) {
  console.error(`банк не заморожений: frozen_at = ${[...frozen].join(', ')}`);
  process.exit(1);
}

if (process.argv.includes('--write-baseline')) {
  const out: Baseline = {};
  for (const [id, c] of now) {
    out[id] = { pow_k: c.ok === c.n ? 1 : Number((c.ok / c.n).toFixed(4)), k: c.n, frozen_at: c.frozen_at };
  }
  writeFileSync('docs/lab3/evals-baseline.json', `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`базовий рівень записано на ${now.size} задач (k=${K})`);
  process.exit(0);
}

const base = JSON.parse(readFileSync('docs/lab3/evals-baseline.json', 'utf8')) as Baseline;
const broke: string[] = [];

for (const [id, c] of now) {
  if (c.bucket !== 'regression') continue;
  const was = base[id]?.pow_k ?? 0;
  const is = c.ok === c.n ? 1 : Number((c.ok / c.n).toFixed(4));
  if (was === 1 && is < 1) {
    broke.push(`${id}: було pass^${base[id]?.k ?? K}=1, стало ${c.ok}/${c.n}`);
  }
}

if (broke.length > 0) {
  console.error(`РЕГРЕСІЯ на ${broke.length} задачах:\n${broke.join('\n')}`);
  process.exit(1);
}

console.log(`регресії немає: перевірено ${now.size} задач, k=${K}`);