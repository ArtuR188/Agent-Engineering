import { trace } from '@opentelemetry/api';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { initTelemetry, shutdownTelemetry } from '../telemetry/otel';
import { appendStopLog, createTaskTimeout } from './stop';

initTelemetry();

const dirs: string[] = [];

function makeLogPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stop-trace-'));
  dirs.push(dir);
  return join(dir, 'stop-log.jsonl');
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await shutdownTelemetry();
});

describe('stop-log trace_id correlation', () => {
  it('автоматично додає активний traceId у appendStopLog', () => {
    const logPath = makeLogPath();
    const tracer = trace.getTracer('test-stop');

    const expectedTraceId = tracer.startActiveSpan('task test-stop-1', (span) => {
      const id = span.spanContext().traceId;
      appendStopLog(
        {
          at: new Date().toISOString(),
          taskId: 'test-stop-1',
          limit: 'isStepCount',
          n: 2,
          detail: 'step limit test',
          action: 'stopped',
        },
        logPath,
      );
      span.end();
      return id;
    });

    const row = JSON.parse(readFileSync(logPath, 'utf8').trim()) as { traceId?: string };
    expect(expectedTraceId).toMatch(/^[0-9a-f]{32}$/);
    expect(row.traceId).toBe(expectedTraceId);
  });

  it('зберігає traceId у createTaskTimeout навіть після завершення синхронного контексту', async () => {
    const logPath = makeLogPath();
    const tracer = trace.getTracer('test-stop');

    const expectedTraceId = tracer.startActiveSpan('task test-timeout-1', (span) => {
      const id = span.spanContext().traceId;
      createTaskTimeout(20, 'test-timeout-1', logPath);
      span.end();
      return id;
    });

    await new Promise((r) => setTimeout(r, 60));
    const row = JSON.parse(readFileSync(logPath, 'utf8').trim()) as { traceId?: string; limit: string };
    expect(row.limit).toBe('taskTimeout');
    expect(row.traceId).toBe(expectedTraceId);
  });
});
