import { registerTelemetry, type Telemetry } from 'ai';
import { OpenTelemetry } from '@ai-sdk/otel';
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

type GlobalTelemetry = typeof globalThis & {
  __otelSdk?: NodeSDK | undefined;
  __otelRegistered?: boolean | undefined;
};

const noopSpanProcessor = {
  forceFlush: async () => {},
  onStart: () => {},
  onEnd: () => {},
  shutdown: async () => {},
};

/** Реєструє NodeSDK + OTLP/HTTP + OpenTelemetry (GenAI) один раз на старті процесу. */
export function initTelemetry(): NodeSDK {
  const g = globalThis as GlobalTelemetry;
  if (!g.__otelSdk) {
    const hasEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim());
    const sdk = new NodeSDK(
      hasEndpoint
        ? { traceExporter: new OTLPTraceExporter() }
        : { spanProcessors: [noopSpanProcessor] },
    );
    sdk.start();
    g.__otelSdk = sdk;
  }
  if (!g.__otelRegistered) {
    // @ai-sdk/otel@1.0.148 тягне власну копію @ai-sdk/provider-utils з іншим [schemaSymbol]
    registerTelemetry(new OpenTelemetry() as unknown as Telemetry);
    g.__otelRegistered = true;
  }
  return g.__otelSdk;
}

export async function flushTelemetry(): Promise<void> {
  const provider = trace.getTracerProvider() as {
    forceFlush?: () => Promise<void>;
    getDelegate?: () => { forceFlush?: () => Promise<void> };
  };
  const target = provider.getDelegate?.() ?? provider;
  if (typeof target.forceFlush === 'function') {
    await target.forceFlush();
  }
}

export async function shutdownTelemetry(): Promise<void> {
  const g = globalThis as GlobalTelemetry;
  if (!g.__otelSdk) return;
  const sdk = g.__otelSdk;
  delete g.__otelSdk;
  await sdk.shutdown();
}
