import { readFileSync } from 'node:fs';
import { agreement, type Label } from '../kappa';

const LABELS: readonly Label[] = ['pass', 'fail', 'unknown'];

interface Case {
  case_id: string;
  artifact: string;
  dimension: string;
  mine: Label;
  holdout: boolean;
}

interface Verdict {
  case_id: string;
  dimension: string;
  verdict: Label;
  model: string;
  order: string;
  reason?: string;
}

const jsonl = <T,>(p: string): T[] =>
  readFileSync(p, 'utf8')
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);

const VERDICTS_PATH = process.argv[2] ?? 'docs/lab3/verdicts/judge.jsonl';
const cases = jsonl<Case>('docs/lab3/judge-cases.jsonl');
const verdicts = jsonl<Verdict>(VERDICTS_PATH);
const key = (c: { case_id: string; dimension: string }) => `${c.case_id}|${c.dimension}`;
const byKey = new Map(verdicts.map((v) => [key(v), v]));

export function confusion(mine: readonly Label[], judge: readonly Label[]) {
  const m: Record<Label, Record<Label, number>> = {
    pass: { pass: 0, fail: 0, unknown: 0 },
    fail: { pass: 0, fail: 0, unknown: 0 },
    unknown: { pass: 0, fail: 0, unknown: 0 },
  };
  mine.forEach((l, i) => {
    const j = judge[i];
    if (j) m[l][j] += 1;
  });
  return m;
}

function report(label: string, subset: readonly Case[]) {
  const paired = subset.filter((c) => byKey.has(key(c)));
  if (paired.length === 0) {
    console.log(`${label}: немає жодного вердикту судді`);
    return;
  }
  const mine = paired.map((c) => c.mine);
  const judge = paired.map((c) => byKey.get(key(c))!.verdict);
  const a = agreement(mine, judge);
  const m = confusion(mine, judge);
  console.log(`\n== ${label} · випадків ${a.n}`);
  console.log(
    `сира згода ${a.raw.toFixed(3)} · очікувана випадкова ${a.expected.toFixed(3)} · каппа ${
      Number.isNaN(a.kappa) ? 'не визначена (усі мітки однакові)' : a.kappa.toFixed(3)
    }`,
  );
  console.log('матриця (рядок = мій, стовпець = суддя):');
  for (const r of LABELS) {
    console.log(`  ${r.padEnd(8)} ${LABELS.map((cc) => String(m[r][cc]).padStart(4)).join('')}`);
  }
  console.log(`  пропускає погане (мій fail -> суддя pass): ${m.fail.pass}`);
  console.log(`  марна робота  (мій pass -> суддя fail): ${m.pass.fail}`);
}

const dims = [...new Set(cases.map((c) => c.dimension))];
for (const d of dims) {
  report(`вимір ${d} · усі`, cases.filter((c) => c.dimension === d));
  report(`вимір ${d} · робочі`, cases.filter((c) => c.dimension === d && !c.holdout));
  report(`вимір ${d} · ВІДКЛАДЕНІ`, cases.filter((c) => c.dimension === d && c.holdout));
}

console.log('\n== Розбіжності на РОБОЧИХ (для ітерації рубрики):');
for (const c of cases.filter((x) => !x.holdout)) {
  const v = byKey.get(key(c));
  if (v && v.verdict !== c.mine) {
    console.log(`  ${c.case_id} [${c.dimension}] mine=${c.mine} judge=${v.verdict} | ${v.reason ?? ''}`);
  }
}

const orders = new Set(verdicts.map((v) => v.order).filter(Boolean));
console.log(`\nпорядків подання в журналі: ${orders.size} (${[...orders].join(', ') || 'порівняння не було'})`);