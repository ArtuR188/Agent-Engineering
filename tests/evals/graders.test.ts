import { describe, expect, it } from 'vitest';
import { grade, noChanges, testsUntouched, touchesOnlyListed } from '../../scripts/evals/graders';
import type { Task } from '../../scripts/harness/run-task';

const baseTask: Task = {
  id: 't-01',
  input: 'test',
  acceptance: ['npm run typecheck'],
  budget: { max_turns: 4, max_usd: 0, timeout_s: 60 },
  files: ['src/mcp/tools.ts'],
  label: { acceptance: true, touches_only_listed: true, tests_untouched: true },
  source: 'test',
  bucket: 'regression',
  frozen_at: '2026-11-22',
};

describe('deterministic graders', () => {
  it('passes when acceptance is green and diff touches only allowed files', () => {
    const patch = '--- a/src/mcp/tools.ts\n+++ b/src/mcp/tools.ts\n@@ -1 +1 @@\n-a\n+b\n';
    const res = grade({
      task: baseTask,
      patch,
      output: 'ok',
      acceptance: [{ cmd: 'npm run typecheck', exit: 0 }],
    });
    expect(res).toHaveLength(3);
    expect(res.every((r) => r.pass)).toBe(true);
  });

  it('detects changes outside allowed files and modified tests', () => {
    const patch = [
      '--- a/src/cost.ts',
      '+++ b/src/cost.ts',
      '@@ -1 +1 @@',
      '-x\n+y',
      '--- a/tests/cost.test.ts',
      '+++ b/tests/cost.test.ts',
      '@@ -1 +1 @@',
      '-a\n+b',
    ].join('\n');

    expect(touchesOnlyListed({ task: baseTask, patch, output: '', acceptance: [] }).pass).toBe(false);
    expect(testsUntouched({ task: baseTask, patch, output: '', acceptance: [] }).pass).toBe(false);
  });

  it('checks empty diff for no_changes', () => {
    expect(noChanges({ task: baseTask, patch: '   \n  ', output: '', acceptance: [] }).pass).toBe(true);
    expect(noChanges({ task: baseTask, patch: '+++ b/README.md\n+hi', output: '', acceptance: [] }).pass).toBe(false);
  });
});