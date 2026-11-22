import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, hasToolCall, tool } from 'ai';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { z } from 'zod';
import { mayRun, recordBreaker } from '../../src/harness/breaker';
import { appendStopLog, createTaskTimeout, stepLimit } from '../../src/harness/stop';

interface HarnessConfig {
  readonly permissionMode: 'dontAsk';
  readonly bypassPermissions: boolean;
  readonly allowedTools: readonly string[];
  readonly isolation: string;
  readonly model: string;
  readonly limits: {
    readonly taskTimeoutMs: number;
    readonly defaultMaxSteps: number;
  };
}

function loadEnvLocal(): void {
  if (process.env.GEMINI_API_KEY || !existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    if (key && !process.env[key]) process.env[key] = val;
  }
}

function argVal(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : fallback;
}

function safeRepoPath(rel: string): string {
  const root = process.cwd();
  const abs = resolve(root, rel);
  const diff = relative(root, abs);
  if (diff.startsWith('..') || /\.env/i.test(diff)) {
    throw new Error(`Заборонений шлях (dontAsk): ${rel}`);
  }
  return abs;
}

async function main() {
  loadEnvLocal();

  const cfg = JSON.parse(readFileSync('.harness/config.json', 'utf8')) as HarnessConfig;
  if (cfg.permissionMode !== 'dontAsk' || cfg.bypassPermissions) {
    throw new Error('Заборонена конфігурація дозволів: потрібен permissionMode=dontAsk і bypassPermissions=false');
  }

  const taskId = argVal('--task', 't-04');
  const maxSteps = Number(argVal('--max-steps', String(cfg.limits.defaultMaxSteps)));
  const timeoutMs = Number(argVal('--timeout-ms', String(cfg.limits.taskTimeoutMs)));
  const simulate429 = process.argv.includes('--simulate-429');

  // Шар 3: перевірка circuit breaker перед запуском задачі
  const gate = mayRun();
  if (!gate.allow) {
    appendStopLog({
      at: new Date().toISOString(),
      taskId,
      limit: 'breakerOpen',
      detail: gate.why,
      action: 'задачу пропущено без виклику моделі (фабрика зупинена брейкером)',
    });
    console.error(`[BREAKER BLOCKED] ${taskId}: ${gate.why}`);
    process.exit(2);
  }
  console.log(`[BREAKER] ${taskId}: ${gate.why}`);

  if (simulate429) {
    appendStopLog({
      at: new Date().toISOString(),
      taskId,
      limit: 'quota429',
      detail: 'HTTP 429 Too Many Requests (симуляція вичерпання квоти провайдера)',
      action: 'брейкер негайно відкрито, наступні задачі заблоковано на cool-down',
    });
    const st = recordBreaker({ ok: false, quota429: true, tripReason: 'HTTP 429' });
    console.error(`[QUOTA 429] ${taskId}: breaker -> ${st.state} (${st.trip})`);
    process.exit(3);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Помилка: GEMINI_API_KEY не задано.');
    process.exit(1);
  }

  // Явний набір дозволених інструментів (dontAsk)
  const allTools = {
    readFile: tool({
      description: 'Прочитати перші 1200 символів файлу в репозиторії.',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const abs = safeRepoPath(path);
        return readFileSync(abs, 'utf8').slice(0, 1200);
      },
    }),
    listFiles: tool({
      description: 'Показати список файлів у каталозі репозиторію.',
      inputSchema: z.object({ dir: z.string() }),
      execute: async ({ dir }) => {
        const abs = safeRepoPath(dir);
        return readdirSync(abs).join('\n');
      },
    }),
    submitArtifact: tool({
      description: 'Завершити задачу та передати фінальний звіт.',
      inputSchema: z.object({ summary: z.string() }),
      execute: async ({ summary }) => ({ accepted: true, summary }),
    }),
  };

  const allowed = new Set(cfg.allowedTools);
  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => allowed.has(name)),
  ) as typeof allTools;

  const prompt = [
    `Задача ${taskId}: перевір структуру проєкту покроково.`,
    'Виконуй РІВНО один виклик інструмента за крок:',
    '1) readFile для package.json',
    '2) readFile для src/models.ts',
    '3) readFile для src/mcp/tools.ts',
    '4) readFile для src/verify/schema.ts',
    '5) Тільки після читання всіх 4 файлів виклич submitArtifact із коротким підсумком.',
  ].join('\n');

  const google = createGoogleGenerativeAI({ apiKey });
  const timeout = createTaskTimeout(timeoutMs, taskId);

  try {
    const res = await generateText({
      model: google(cfg.model),
      prompt,
      tools,
      stopWhen: [stepLimit(maxSteps, taskId), hasToolCall('submitArtifact')],
      abortSignal: timeout.signal,
    });

    const submitted = res.steps.some((s) =>
      s.toolCalls.some((tc) => tc.toolName === 'submitArtifact'),
    );

    console.log(
      `[DONE] ${taskId}: steps=${res.steps.length}/${maxSteps}, submitted=${String(submitted)}`,
    );

    if (!submitted) {
      const st = recordBreaker({ ok: false, tripReason: `step_limit_${maxSteps}` });
      console.error(`[STOPPED] ${taskId}: ліміт кроків ${maxSteps}, breaker=${st.state} (fails=${st.fails})`);
      process.exit(1);
    }

    const st = recordBreaker({ ok: true, madeProgress: true });
    console.log(`[OK] ${taskId}: breaker=${st.state}`);
  } catch (err) {
    const msg = String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    if (is429) {
      appendStopLog({
        at: new Date().toISOString(),
        taskId,
        limit: 'quota429',
        detail: msg.slice(0, 200),
        action: 'брейкер відкрито через 429 від провайдера',
      });
    }
    const st = recordBreaker({ ok: false, quota429: is429, tripReason: msg.slice(0, 80) });
    console.error(`[ERROR] ${taskId}: ${msg.slice(0, 160)} | breaker=${st.state}`);
    process.exit(1);
  } finally {
    timeout.clear();
  }
}

main();