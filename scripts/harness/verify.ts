import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { criterionVerdict, isBlocked, verifyReport, type CriterionVerdict } from '../../src/verify/schema';

function sanitizeDiff(diff: string): string {
  const withoutEnv = diff.replace(
    /^diff --git a\/[^\n]*\.env[^\n]*[\s\S]*?(?=^diff --git |(?![\s\S]))/gm,
    '',
  );
  return withoutEnv
    .replace(/(AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z]{20,})/g, '[REDACTED]')
    .replace(/^([+-]?\s*[A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*\s*=\s*)(.+)$/gm, '$1[REDACTED]');
}

const MODEL = process.env.VERIFIER_MODEL ?? 'gemini-3.5-flash-lite';

interface TaskDef {
  id: string;
  input: string;
}

function loadTaskInput(taskId: string): string {
  const path = 'docs/lab3/tasks.jsonl';
  if (!existsSync(path)) return '(опис задачі відсутній)';
  const lines = readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  for (const line of lines) {
    const t = JSON.parse(line) as TaskDef;
    if (t.id === taskId) return t.input;
  }
  return '(опис задачі не знайдено у tasks.jsonl)';
}

async function fetchWithRetry(url: string, body: string): Promise<Response> {
  const delays = [5000, 15000, 30000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body,
      });
      if (res.status === 429) {
        const txt = await res.clone().text();
        if (txt.includes('PerDay')) return res;
      }
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      if (i === delays.length) return res;
    } catch (err) {
      if (i === delays.length) throw err;
    }
    const ms = delays[i] ?? 10000;
    console.warn(`Gemini API повтор (${i + 1}/${delays.length}) через ${ms / 1000}с...`);
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error('fetchWithRetry failed');
}

async function judgeCriterion(
  apiKey: string,
  taskId: string,
  taskInput: string,
  criterion: string,
  diff: string,
): Promise<CriterionVerdict> {
  const prompt = [
    'Ти строгий верифікатор коду. Оціни ОДИН критерій приймання за описом задачі та git diff.',
    `Задача (${taskId}): ${taskInput}`,
    `Критерій (id): ${criterion}`,
    'Git diff:',
    diff,
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

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetchWithRetry(url, payload);
    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = raw.replace(/^`{3}json\s*/i, '').replace(/^`{3}\s*/i, '').replace(/`{3}$/i, '').trim();
    try {
      return criterionVerdict.parse(JSON.parse(cleaned));
    } catch (err) {
      if (attempt === 2) throw new Error(`Невалідна відповідь моделі після 2 спроб: ${String(err)}`);
    }
  }
  throw new Error('Неочікуване завершення циклу перевірки');
}

function resolveRunDir(): string | null {
  const idx = process.argv.indexOf('--run');
  const arg = process.argv[idx + 1];
  if (idx > 0 && arg) return arg;

  const root = 'docs/lab3/runs';
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .map((d) => join(root, d))
    .filter((p) => statSync(p).isDirectory());
  const ts = (x: string) => Number(x.split('-').pop()) || 0;
  return dirs.sort((a, b) => ts(b) - ts(a))[0] ?? null;
}

async function main() {
  const runDir = resolveRunDir();
  if (!runDir) {
    console.log('Немає прогонів у docs/lab3/runs — пропуск верифікації.');
    process.exit(0);
  }

  const runJson = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8')) as {
    task_id: string;
    acceptance?: { cmd: string }[];
  };
  const taskInput = loadTaskInput(runJson.task_id);
  const diffPath = join(runDir, 'patch.diff');
  const rawDiff = existsSync(diffPath) ? readFileSync(diffPath, 'utf8') : '';
  const safeDiff = sanitizeDiff(rawDiff);

  const uniqueCriteria = Array.from(new Set((runJson.acceptance ?? []).map((a) => a.cmd)));
  if (uniqueCriteria.length === 0) uniqueCriteria.push(runJson.task_id);

  const results: CriterionVerdict[] = [];

  if (safeDiff.trim() === '') {
    for (const c of uniqueCriteria) {
      results.push({
        id: c,
        verdict: 'unknown',
        reason: 'patch.diff порожній — немає змін для верифікації.',
        evidence: '',
      });
    }
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Помилка: GEMINI_API_KEY не задано.');
      process.exit(1);
    }
    for (const c of uniqueCriteria) {
      results.push(await judgeCriterion(apiKey, runJson.task_id, taskInput, c, safeDiff));
    }
  }

  const report = verifyReport.parse({ results });
  mkdirSync('docs/lab3/verdicts', { recursive: true });
  const outFile = join('docs/lab3/verdicts', `${runJson.task_id}.json`);
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Вердикт збережено: ${outFile}`);

  if (isBlocked(report)) {
    console.error('БРАМА ЗАБЛОКОВАНА (є вердикт != pass):', JSON.stringify(report.results, null, 2));
    process.exit(1);
  }
  console.log('БРАМА ПРОЙДЕНА (усі критерії pass).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});