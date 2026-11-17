import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : 'skipped';
};

const verdict = (r) => (r === 'success' ? 'pass' : r === 'skipped' || r === 'cancelled' ? 'skipped' : 'fail');

const gates = {
  types: verdict(arg('types')),
  lint: verdict(arg('lint')),
  tests: verdict(arg('tests')),
  build: verdict(arg('build')),
};

const root = 'docs/lab3/runs';
// Якщо локально ще немає артефактів, просто робимо пусту заглушку (для GitHub)
if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

const dirs = readdirSync(root).map((d) => join(root, d)).filter((p) => statSync(p).isDirectory());
const latest = dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

if (!latest) {
  // Для того щоб CI не падав при пустому запуску на main
  console.log('немає жодного прогону в docs/lab3/runs — записую тільки gate-record.json');
  writeFileSync('gate-record.json', `${JSON.stringify({ task_id: 'none', artifact_dir: 'none', gates, ci_run_url: arg('run-url') }, null, 2)}\n`, 'utf8');
  process.exit(0);
}

const file = join(latest, 'run.json');
const record = { ...JSON.parse(readFileSync(file, 'utf8')), gates, ci_run_url: arg('run-url') };
writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
writeFileSync('gate-record.json', `${JSON.stringify({ task_id: record.task_id, artifact_dir: record.artifact_dir, gates, ci_run_url: record.ci_run_url }, null, 2)}\n`, 'utf8');
console.log(`вердикти записано: ${file}`);
