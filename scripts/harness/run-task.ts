import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Task {
  readonly id: string;
  readonly input: string;
  readonly acceptance: readonly string[];
  readonly budget: { readonly max_turns: number; readonly max_usd: number; readonly timeout_s: number };
  readonly files?: readonly string[];
  readonly label?: Readonly<Record<string, boolean>>;
  readonly source?: string;
  readonly bucket?: 'regression' | 'new' | 'edge';
  readonly frozen_at?: string;
}

export interface AgentResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export type AgentRunner = (task: Task, cwd: string) => AgentResult;

export interface RunRecord {
  readonly task_id: string;
  readonly agent_path: string;
  readonly artifact_dir: string;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_s: number;
  readonly exit_status: 'ok' | 'agent_failed' | 'timeout' | 'budget_or_turns';
  readonly acceptance: readonly { readonly cmd: string; readonly exit: number }[];
  readonly acceptance_passed: boolean;
  readonly session_id: string | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cost_usd_estimate: number | null;
  readonly trace_id: string | null;
  readonly gates: Record<string, 'pass' | 'fail' | 'skipped'>;
}

function spawnAgent(bin: string, args: readonly string[], cwd: string, timeoutS: number): AgentResult {
  const r = spawnSync(bin, [...args], {
    cwd, encoding: 'utf8', timeout: timeoutS * 1000, killSignal: 'SIGINT', shell: process.platform === 'win32',
  });
  return {
    exitCode: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '',
    timedOut: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT',
  };
}

export const opencodeRunner: AgentRunner = (task, cwd) => spawnAgent('npx', ['opencode', '-p', task.input], cwd, task.budget.timeout_s);

export function readMeta(stdout: string) {
  const empty = { session_id: null, input_tokens: null, output_tokens: null, cost_usd_estimate: null };
  try {
    const j = JSON.parse(stdout) as Record<string, unknown>;
    return {
      session_id: typeof j.session_id === 'string' ? j.session_id : null,
      input_tokens: typeof j.input_tokens === 'number' ? j.input_tokens : null,
      output_tokens: typeof j.output_tokens === 'number' ? j.output_tokens : null,
      cost_usd_estimate: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : 0,
    };
  } catch { return empty; }
}

export function checkAcceptance(task: Task, cwd: string) {
  return task.acceptance.map((cmd) => {
    const r = spawnSync(cmd, { cwd, encoding: 'utf8', shell: true, timeout: task.budget.timeout_s * 1000 });
    return { cmd, exit: r.status ?? 1 };
  });
}

export function runTask(
  task: Task,
  opts: { runner: AgentRunner; agentPath: string; worktree: string; outDir: string; check?: typeof checkAcceptance },
): RunRecord {
  const dir = join(opts.outDir, `${task.id}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const started = new Date();
  const res = opts.runner(task, opts.worktree);
  
  let patch = '';
  try {
    execFileSync('git', ['add', '-A'], { cwd: opts.worktree });
    patch = execFileSync('git', ['diff', '--cached'], { cwd: opts.worktree, encoding: 'utf8' });
  } catch {}
  writeFileSync(join(dir, 'patch.diff'), patch, 'utf8');
  writeFileSync(join(dir, 'output.txt'), res.stdout, 'utf8');
  writeFileSync(join(dir, 'agent.log'), res.stderr, 'utf8');
  
  let exitStatus: 'ok' | 'agent_failed' | 'timeout' | 'budget_or_turns' = res.exitCode === 0 ? 'ok' : 'agent_failed';
  if (res.timedOut) exitStatus = 'timeout';
  if (res.stderr.includes('Budget limit reached') || res.stdout.includes('Budget limit reached')) exitStatus = 'budget_or_turns';

  const acceptance = (opts.check ?? checkAcceptance)(task, opts.worktree);
  const ended = new Date();
  const record: RunRecord = {
    task_id: task.id, agent_path: opts.agentPath, artifact_dir: dir,
    started_at: started.toISOString(), ended_at: ended.toISOString(),
    duration_s: Math.round((ended.getTime() - started.getTime()) / 100) / 10,
    exit_status: exitStatus, acceptance,
    acceptance_passed: acceptance.length > 0 && acceptance.every((a) => a.exit === 0),
    ...readMeta(res.stdout), trace_id: null, gates: {},
  };
  writeFileSync(join(dir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}
