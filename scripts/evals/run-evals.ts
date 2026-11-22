import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, hasToolCall, isStepCount, tool } from 'ai';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { estimateCost } from '../../src/models';
import { checkAcceptance, type Task } from '../harness/run-task';
import { grade } from './graders';

const K = Math.max(1, Number(process.env.EVAL_K ?? 3));
const ONLY_BUCKET = process.env.EVAL_BUCKET ?? '';
const ONLY_IDS = new Set(
  (process.env.EVAL_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const BANK = process.argv[2] ?? 'docs/lab3/tasks.jsonl';
const LOG = 'docs/lab3/evals.jsonl';
const MODEL_ID = process.env.EVAL_MODEL ?? 'gemini-3.5-flash-lite';
const SHA = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

function loadEnvLocal(): void {
  if (process.env.GEMINI_API_KEY || !existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    if (key && !process.env[key]) process.env[key] = val;
  }
}

function safePath(root: string, rel: string): string {
  const abs = resolve(root, rel);
  const d = relative(root, abs);
  if (d.startsWith('..') || /\.env/i.test(d)) {
    throw new Error(`Заборонений шлях: ${rel}`);
  }
  return abs;
}

function linkNodeModules(worktree: string): string {
  const src = resolve('node_modules');
  const dst = resolve(worktree, 'node_modules');
  if (!existsSync(dst) && existsSync(src)) {
    symlinkSync(src, dst, process.platform === 'win32' ? 'junction' : 'dir');
  }
  return dst;
}

function unlinkNodeModules(dst: string): void {
  if (!existsSync(dst)) return;
  try {
    if (process.platform === 'win32') rmdirSync(dst);
    else unlinkSync(dst);
  } catch {}
}

async function runSingleAttempt(task: Task, worktree: string, outDir: string, apiKey: string) {
  mkdirSync(outDir, { recursive: true });
  const started = new Date();
  let outputText = '';
  let exitStatus: 'ok' | 'agent_failed' | 'timeout' = 'ok';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  const google = createGoogleGenerativeAI({ apiKey });
  const tools = {
    readFile: tool({
      description: 'Прочитати файл із поточного робочого дерева.',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => readFileSync(safePath(worktree, path), 'utf8').slice(0, 4000),
    }),
    writeFile: tool({
      description: 'Записати файл у поточному робочому дереві.',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        const abs = safePath(worktree, path);
        writeFileSync(abs, content, 'utf8');
        return `written:${path}`;
      },
    }),
    submitArtifact: tool({
      description: 'Завершити роботу над задачею з коротким звітом.',
      inputSchema: z.object({ summary: z.string() }),
      execute: async ({ summary }) => ({ done: true, summary }),
    }),
  };

  const maxSteps = Math.min(Math.max(5, task.budget.max_turns), 6);

  try {
    const res = await generateText({
      model: google(MODEL_ID),
      prompt: [
        `Виконай задачу ${task.id} у робочому дереві.`,
        `Інструкція: ${task.input}`,
        `Дозволені файли: ${(task.files ?? []).join(', ') || 'НЕ змінюй і НЕ створюй жодних файлів'}.`,
        'Якщо задача просить лише перевірити або не стосується коду — нічого не редагуй і одразу виклич submitArtifact.',
      ].join('\n'),
      tools,
      stopWhen: [isStepCount(maxSteps), hasToolCall('submitArtifact')],
    });
    outputText = res.text || 'completed';
    inputTokens = res.totalUsage?.inputTokens ?? null;
    outputTokens = res.totalUsage?.outputTokens ?? null;
  } catch (err) {
    exitStatus = 'agent_failed';
    outputText = String(err);
  }

  let patch = '';
  try {
    execFileSync('git', ['add', '-A', '--', '.', ':!node_modules'], { cwd: worktree });
    patch = execFileSync('git', ['diff', '--cached'], { cwd: worktree, encoding: 'utf8' });
  } catch {}

  const acceptance = checkAcceptance(task, worktree);
  const ended = new Date();
  const durationS = Math.round((ended.getTime() - started.getTime()) / 100) / 10;
  const costUsdEstimate =
    inputTokens !== null && outputTokens !== null
      ? Number(estimateCost('cheap', inputTokens, outputTokens).toFixed(6))
      : null;

  writeFileSync(join(outDir, 'patch.diff'), patch, 'utf8');
  writeFileSync(join(outDir, 'output.txt'), outputText, 'utf8');

  return {
    patch,
    outputText,
    acceptance,
    durationS,
    inputTokens,
    outputTokens,
    costUsdEstimate,
    exitStatus,
  };
}

export function summarize(
  lines: readonly { task_id: string; bucket: string; pass: boolean }[],
  k: number,
) {
  const byTask = new Map<string, { bucket: string; ok: number; n: number }>();
  for (const l of lines) {
    const cur = byTask.get(l.task_id) ?? { bucket: l.bucket, ok: 0, n: 0 };
    byTask.set(l.task_id, { bucket: cur.bucket, ok: cur.ok + (l.pass ? 1 : 0), n: cur.n + 1 });
  }
  const buckets = new Map<string, { tasks: number; at_k: number; pow_k: number }>();
  for (const { bucket, ok, n } of byTask.values()) {
    const b = buckets.get(bucket) ?? { tasks: 0, at_k: 0, pow_k: 0 };
    buckets.set(bucket, {
      tasks: b.tasks + 1,
      at_k: b.at_k + (ok >= 1 ? 1 : 0),
      pow_k: b.pow_k + (ok === n && n === k ? 1 : 0),
    });
  }
  return [...buckets].map(([bucket, b]) => ({
    bucket,
    tasks: b.tasks,
    pass_at_k: Number((b.at_k / b.tasks).toFixed(3)),
    pass_pow_k: Number((b.pow_k / b.tasks).toFixed(3)),
  }));
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не знайдено в середовищі або .env.local');
  }

  const tasks: Task[] = readFileSync(BANK, 'utf8')
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Task)
    .filter((t) => ONLY_BUCKET === '' || t.bucket === ONLY_BUCKET)
    .filter((t) => ONLY_IDS.size === 0 || ONLY_IDS.has(t.id));

  if (tasks.length === 0) {
    throw new Error(`Немає задач для запуску (bucket=${ONLY_BUCKET || 'all'})`);
  }

  if (process.env.EVAL_RESET_LOG === '1' || !existsSync(LOG)) {
    mkdirSync('docs/lab3', { recursive: true });
    writeFileSync(LOG, '', 'utf8');
  }

  const git = (args: string[], cwd = '.') => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const sessionLines: { task_id: string; bucket: string; pass: boolean }[] = [];

  for (const task of tasks) {
    for (let attempt = 1; attempt <= K; attempt += 1) {
      const branch = `eval/${task.id}-${attempt}-${Date.now()}`;
      const tree = join('..', 'eval-runs', `${task.id}-${attempt}-${process.pid}`);
      git(['worktree', 'add', '-b', branch, tree, 'HEAD']);
      const nmDst = linkNodeModules(tree);
      try {
        const outDir = join('.harness', 'eval-tmp', `${task.id}-a${attempt}`);
        const r = await runSingleAttempt(task, tree, outDir, apiKey);
        const results = grade({
          task,
          patch: r.patch,
          output: r.outputText,
          acceptance: r.acceptance,
        });
        const passed = results.length > 0 && results.every((g) => g.pass);
        const row = {
          task_id: task.id,
          bucket: task.bucket ?? 'regression',
          frozen_at: task.frozen_at ?? '2026-11-22',
          attempt,
          sha: SHA,
          pass: passed,
          graders: results,
          duration_s: r.durationS,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          cost_usd_estimate: r.costUsdEstimate,
          exit_status: r.exitStatus,
          trace_id: null,
          at: new Date().toISOString(),
        };
        appendFileSync(LOG, `${JSON.stringify(row)}\n`, 'utf8');
        sessionLines.push({ task_id: task.id, bucket: row.bucket, pass: row.pass });
        console.log(`${task.id} #${attempt}/${K} [${row.bucket}]: ${passed ? 'PASS' : 'FAIL'} (${r.durationS}s)`);
        if (!passed) { console.log('  reason:', r.exitStatus, results.filter((g) => !g.pass).map((g) => `${g.id}=${g.detail}`).join(' | ')); }
      } finally {
        unlinkNodeModules(nmDst);
        try { git(['worktree', 'remove', tree, '--force']); } catch {}
        try { git(['branch', '-D', branch]); } catch {}
      }
    }
  }

  console.table(summarize(sessionLines, K));
}

main();