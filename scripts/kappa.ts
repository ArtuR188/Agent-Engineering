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

if (process.argv[1]?.endsWith('kappa.ts')) {
  const mine: Label[] = ['pass', 'pass', 'fail', 'fail', 'pass', 'unknown', 'pass', 'fail', 'pass', 'fail'];
  const judge: Label[] = ['pass', 'pass', 'fail', 'fail', 'pass', 'fail', 'pass', 'fail', 'pass', 'fail'];
  const r = agreement(mine, judge);
  console.log(`n=${r.n} | raw=${r.raw.toFixed(3)} | expected=${r.expected.toFixed(3)} | kappa=${r.kappa.toFixed(3)}`);
}
