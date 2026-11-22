import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadBreaker, mayRun, recordBreaker } from './breaker';

const dirs: string[] = [];
function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), 'breaker-test-'));
  dirs.push(dir);
  return join(dir, 'breaker.json');
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe('circuit breaker', () => {
  it('opens immediately on HTTP 429 quota exhaustion and blocks during cooldown', () => {
    const file = tempFile();
    const t0 = Date.parse('2026-11-22T12:00:00Z');
    const st = recordBreaker({ ok: false, quota429: true, tripReason: 'HTTP 429' }, file, t0);
    expect(st.state).toBe('open');
    expect(st.trip).toBe('provider_quota_429');

    const blocked = mayRun(file, t0 + 5 * 60_000);
    expect(blocked.allow).toBe(false);
  });

  it('transitions open -> half-open (single probe) -> closed on success, or open with 2x cooldown on failure', () => {
    const file = tempFile();
    const t0 = Date.parse('2026-11-22T12:00:00Z');
    recordBreaker({ ok: false, tripReason: 'lint' }, file, t0);
    recordBreaker({ ok: false, tripReason: 'lint' }, file, t0 + 1000);
    const opened = recordBreaker({ ok: false, tripReason: 'lint' }, file, t0 + 2000);
    expect(opened.state).toBe('open');
    expect(opened.cooldownMin).toBe(15);

    const probe = mayRun(file, t0 + 16 * 60_000);
    expect(probe.allow).toBe(true);
    expect(probe.probe).toBe(true);

    // Друга задача під час активного half-open блокується
    const second = mayRun(file, t0 + 16 * 60_000 + 1000);
    expect(second.allow).toBe(false);

    // Провал пробної задачі одразу відкриває брейкер із подвоєним перепочинком (30 хв)
    const reopened = recordBreaker({ ok: false, tripReason: 'still_broken' }, file, t0 + 16 * 60_000 + 2000);
    expect(reopened.state).toBe('open');
    expect(reopened.cooldownMin).toBe(30);

    // Після 31 хв — нова проба, зелена закриває брейкер
    const probe2 = mayRun(file, t0 + 48 * 60_000);
    expect(probe2.allow).toBe(true);
    const closed = recordBreaker({ ok: true, madeProgress: true }, file, t0 + 48 * 60_000 + 1000);
    expect(closed.state).toBe('closed');
    expect(closed.fails).toBe(0);
    expect(loadBreaker(file).cooldownMin).toBe(15);
  });
});