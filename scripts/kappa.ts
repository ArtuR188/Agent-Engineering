import { existsSync, readFileSync } from 'node:fs';

export type Label = 'pass' | 'fail' | 'unknown';
const LABELS: Label[] = ['pass', 'fail', 'unknown'];

export function agreement(mine: Label[], judge: Label[]) {
  const n = mine.length;
  if (n === 0 || n !== judge.length) throw new Error('різна довжина розмітки');
  const po = mine.filter((m, i) => m === judge[i]).length / n;
  const pe = LABELS.reduce((acc, l) => {
    const pm = mine.filter((x) => x === l).length / n;
    const pj = judge.filter((x) => x === l).length / n;
    return acc + pm * pj;
  }, 0);
  const kappa = pe === 1 ? NaN : (po - pe) / (1 - pe);
  return { n, raw: po, expected: pe, kappa };
}

export function confusionMatrix(mine: Label[], judge: Label[]): Record<Label, Record<Label, number>> {
  const m: Record<Label, Record<Label, number>> = {
    pass: { pass: 0, fail: 0, unknown: 0 },
    fail: { pass: 0, fail: 0, unknown: 0 },
    unknown: { pass: 0, fail: 0, unknown: 0 },
  };
  for (let i = 0; i < mine.length; i++) {
    const a = mine[i];
    const b = judge[i];
    if (a && b) m[a][b] += 1;
  }
  return m;
}

if (process.argv[1]?.endsWith('kappa.ts')) {
  const file = 'docs/lab3/verdicts/calibration-10.json';
  if (!existsSync(file)) {
    console.error('Спочатку запусти: npx tsx scripts/harness/calibrate.ts');
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(file, 'utf8')) as { mine: Label; judge: Label }[];
  const mine = rows.map((r) => r.mine);
  const judge = rows.map((r) => r.judge);
  const r = agreement(mine, judge);
  const cm = confusionMatrix(mine, judge);

  console.log(`n=${r.n} | raw=${r.raw.toFixed(3)} | expected=${r.expected.toFixed(3)} | kappa=${r.kappa.toFixed(3)}`);
  console.log('Confusion matrix (rows=mine, cols=judge):');
  console.log(`  pass:    pass=${cm.pass.pass}, fail=${cm.pass.fail}, unknown=${cm.pass.unknown}`);
  console.log(`  fail:    pass=${cm.fail.pass}, fail=${cm.fail.fail}, unknown=${cm.fail.unknown}`);
  console.log(`  unknown: pass=${cm.unknown.pass}, fail=${cm.unknown.fail}, unknown=${cm.unknown.unknown}`);
}