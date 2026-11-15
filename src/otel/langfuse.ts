// src/otel/langfuse.ts — один процесор на весь процес (Next.js бандлить instrumentation і route окремо)
import { LangfuseSpanProcessor } from '@langfuse/otel';

const clean = (v?: string): string => (v ?? '').trim().replace(/^["']|["']$/g, '');
const g = globalThis as typeof globalThis & { __langfuseSpanProcessor?: LangfuseSpanProcessor };

export const langfuseSpanProcessor = (g.__langfuseSpanProcessor ??= new LangfuseSpanProcessor({
  publicKey: clean(process.env.LANGFUSE_PUBLIC_KEY),
  secretKey: clean(process.env.LANGFUSE_SECRET_KEY),
  baseUrl: clean(process.env.LANGFUSE_BASE_URL) || 'https://cloud.langfuse.com',
  exportMode: 'immediate', // serverless: кожен спан відправляється одразу, а не батчем
}));
