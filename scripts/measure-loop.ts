import { z } from 'zod';

import { chatCompletionsModel, messagesModel } from '../src/agent/adapters';
import { runAgentLoop, type Model } from '../src/agent/agent-loop';
import { createTools, jsonlLogger } from '../src/agent/tools';
import { priceUsd } from '../src/cost';
import { CATALOG, MODELS, type ModelSpec } from '../src/models';

const Proposal = z
  .object({
    summary: z.string().min(1),
    files: z.array(z.object({ path: z.string().min(1), content: z.string().min(1) }).strict()).min(1),
  })
  .strict();

const SYSTEM = [
  '/no_think',
  'Ти агент кодування в цьому репозиторії (Next.js App Router, TypeScript strict, Vitest).',
  'Маєш лише інструменти читання list_files і read_file. Спершу прочитай src/health.ts і tests/health.test.ts.',
  'Коли рішення готове, відповідай БЕЗ викликів інструментів, лише JSON:',
  '{"summary": "що зроблено", "files": [{"path": "app/api/health/route.ts", "content": "повний вміст файлу"}]}',
].join('\n');
const TASK =
  'Додай ендпоінт GET /api/health так, щоб проходив tests/health.test.ts (контракт — src/health.ts). Запропонуй повний вміст файлів. /no_think';

function pick(kind: string): { model: Model; spec: ModelSpec; form: string } {
  if (kind === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY порожній: заповніть .env.local');
    const spec = CATALOG['gemini-3.8-flash'];
    return {
      spec,
      form: 'chat-completions',
      model: chatCompletionsModel({
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: spec.id,
        headers: { authorization: `Bearer ${key}` },
      }),
    };
  }
  const spec = MODELS.local;
  if (kind === 'ollama-messages') {
    return { spec, form: 'messages', model: messagesModel({ url: `${spec.baseUrl}/v1/messages`, model: spec.id, maxTokens: 250, think: false }) };
  }
  if (kind === 'ollama-chat') {
    return { spec, form: 'chat-completions', model: chatCompletionsModel({ url: `${spec.baseUrl}/v1/chat/completions`, model: spec.id, think: false }) };
  }
  throw new Error(`Невідомий провайдер «${kind}». Є: ollama-messages, ollama-chat, gemini`);
}

const [kind = 'ollama-messages', runsArg = '1'] = process.argv.slice(2);
const { model, spec, form } = pick(kind);
const runs = Number(runsArg);
const tools = createTools(process.cwd());
const log = jsonlLogger('.agent-log/agent-loop.jsonl');
let valid = 0;
let firstOutput: unknown;

console.log('| # | провайдер | форма API | модель | зупинка | кроки | вхідні | кешовані | вихідні | $ фактично | $ за прайсом | затримка, мс | session |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (let i = 1; i <= runs; i++) {
  const session = `agent-loop-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const started = performance.now();
  try {
    const r = await runAgentLoop({
      model, tools, system: SYSTEM, task: TASK, output: Proposal, maxSteps: 12, tokenBudget: 150_000, session, log,
    });
    const ms = Math.round(performance.now() - started);
    const u = r.usage;
    console.log(
      `| ${i} | ${kind} | ${form} | ${spec.id} | ${r.stop} | ${r.steps} | ${u.inputTokens} | ${u.cachedTokens} | ${u.outputTokens} | 0 | ${priceUsd(spec, u).toFixed(6)} | ${ms} | ${session} |`,
    );
    if (r.stop === 'done') {
      valid++;
      firstOutput ??= r.output;
    }
  } catch (error) {
    console.error(`Прогін ${i} перервано:`, error instanceof Error ? error.message : error);
    break;
  }
}
console.log(`\nВалідних структурованих виходів: ${valid} з ${runs}`);
if (firstOutput !== undefined) {
  console.log(JSON.stringify(firstOutput, null, 2));
}
