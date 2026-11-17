import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTask, type AgentRunner, type Task } from '../../scripts/harness/run-task';

const task: Task = { id: 't-test', input: 'test', acceptance: ['npm run typecheck'], budget: { max_turns: 2, max_usd: 0, timeout_s: 30 } };
const fake = (exitCode: number, stdout = '', stderr = '', timedOut = false): AgentRunner => () => ({ exitCode, stdout, stderr, timedOut });
const tmp = () => mkdtempSync(join(tmpdir(), 'harness-'));

describe('runTask (offline)', () => {
  it('пише журнал і артефакт на успішному прогоні', () => {
    const out = tmp();
    const rec = runTask(task, { runner: fake(0, JSON.stringify({ session_id: 'abc', total_cost_usd: 0 })), agentPath: 'fake', worktree: tmp(), outDir: out });
    expect(rec.exit_status).toBe('ok');
    expect(JSON.parse(readFileSync(join(rec.artifact_dir, 'run.json'), 'utf8')).task_id).toBe('t-test');
  });
  it('пише журнал навіть коли агент упав', () => {
    const rec = runTask(task, { runner: fake(1, '', 'boom'), agentPath: 'fake', worktree: tmp(), outDir: tmp() });
    expect(rec.exit_status).toBe('agent_failed');
    expect(readFileSync(join(rec.artifact_dir, 'agent.log'), 'utf8')).toContain('boom');
  });
  it('відрізняє вичерпаний бюджет від падіння', () => {
    const rec = runTask(task, { runner: fake(1, '', 'Budget limit reached'), agentPath: 'fake', worktree: tmp(), outDir: tmp() });
    expect(rec.exit_status).toBe('budget_or_turns');
  });
});
