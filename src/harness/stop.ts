import { trace } from '@opentelemetry/api';
import { isStepCount } from 'ai';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const STOP_LOG_PATH = 'docs/lab3/stop-log.jsonl';

export interface StopLogEntry {
  readonly at: string;
  readonly taskId: string;
  readonly limit: 'isStepCount' | 'taskTimeout' | 'breakerOpen' | 'quota429';
  readonly detail: string;
  readonly n?: number;
  readonly traceId?: string;
  readonly action: string;
}

function activeTraceId(): string | undefined {
  const id = trace.getActiveSpan()?.spanContext().traceId;
  return id && id !== '0'.repeat(32) ? id : undefined;
}

export function appendStopLog(entry: StopLogEntry, logPath = STOP_LOG_PATH): void {
  mkdirSync(dirname(logPath), { recursive: true });
  const traceId = entry.traceId ?? activeTraceId();
  const payload: StopLogEntry = traceId ? { ...entry, traceId } : entry;
  appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
}

/**
 * Обгортка над isStepCount(n) із AI SDK: при спрацюванні фіксує рядок у stop-log.jsonl із traceId.
 */
export function stepLimit(n: number, taskId: string, logPath = STOP_LOG_PATH) {
  const inner = isStepCount(n);
  const boundTraceId = activeTraceId();
  let logged = false;
  const wrapped: typeof inner = (...args) => {
    const res = inner(...args);
    Promise.resolve(res).then((hit) => {
      if (!hit || logged) return;
      logged = true;
      const traceId = activeTraceId() ?? boundTraceId;
      appendStopLog(
        {
          at: new Date().toISOString(),
          taskId,
          limit: 'isStepCount',
          n,
          ...(traceId ? { traceId } : {}),
          detail: `Досягнуто ліміт кроків циклу (${n}) до виклику submitArtifact`,
          action: 'зупинено цикл generateText, задача помічена як incomplete',
        },
        logPath,
      );
    });
    return res;
  };
  return wrapped;
}

/**
 * Таймаут на одну задачу через AbortController (шар задачі для безкоштовного шляху).
 */
export function createTaskTimeout(timeoutMs: number, taskId: string, logPath = STOP_LOG_PATH) {
  const controller = new AbortController();
  const boundTraceId = activeTraceId();
  const timer = setTimeout(() => {
    const traceId = activeTraceId() ?? boundTraceId;
    appendStopLog(
      {
        at: new Date().toISOString(),
        taskId,
        limit: 'taskTimeout',
        n: timeoutMs,
        ...(traceId ? { traceId } : {}),
        detail: `Перевищено таймаут задачі (${timeoutMs} ms)`,
        action: 'перервано виклик моделі через AbortController',
      },
      logPath,
    );
    controller.abort(new Error(`Task timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}
