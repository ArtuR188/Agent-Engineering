import { describe, expect, it } from 'vitest';
import { assertReadAllowed, assertSafeOutput, assertWriteAllowed } from './policy';

describe('harness security policy', () => {
  it('блокує читання .env та вихід за межі worktree', () => {
    expect(() => assertReadAllowed('/repo', '.env')).toThrow(/policy/);
    expect(() => assertReadAllowed('/repo', '../pwned.txt')).toThrow(/policy/);
  });

  it('блокує запис у tests/, .harness/ та поза білим списком', () => {
    expect(() => assertWriteAllowed('/repo', 'tests/mcp.test.ts', '// x', ['src/mcp/tools.ts'])).toThrow(/policy/);
    expect(() => assertWriteAllowed('/repo', 'tests/mcp.test.ts', '// x')).toThrow(/policy/);
    expect(() => assertWriteAllowed('/repo', '.harness/config.json', '{}', ['.harness/config.json'])).toThrow(/policy/);
    expect(() => assertWriteAllowed('/repo', 'src/other.ts', 'x', ['src/mcp/tools.ts'])).toThrow(/policy/);
    expect(() => assertWriteAllowed('/repo', 'src/other.ts', 'x', [])).toThrow(/policy/);
  });

  it('дозволяє запис у тест, явно перелічений у білому списку задачі (напр. t-06)', () => {
    expect(assertWriteAllowed('/repo', 'tests/dummy.test.ts', 'expect(1).toBe(1);', ['tests/dummy.test.ts'])).toContain(
      'dummy.test.ts',
    );
  });

  it('блокує прапорці обходу дозволів у вмісті', () => {
    expect(() =>
      assertWriteAllowed('/repo', 'src/mcp/tools.ts', '--dangerously-skip-permissions', ['src/mcp/tools.ts']),
    ).toThrow(/policy/);
  });

  it('блокує витік канарки у вихідному каналі', () => {
    expect(() => assertSafeOutput('result: канарка-NOT-A-SECRET-7f3a')).toThrow(/egress policy/);
    expect(assertSafeOutput('clean summary')).toBe('clean summary');
  });
});
