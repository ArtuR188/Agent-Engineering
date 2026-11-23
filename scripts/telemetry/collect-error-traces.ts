import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, hasToolCall, isStepCount, tool } from 'ai';
import { trace } from '@opentelemetry/api';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { createTaskTimeout, stepLimit } from '../../src/harness/stop';
import { estimateCost } from '../../src/models';
import { initTelemetry, shutdownTelemetry } from '../../src/telemetry/otel';

type ErrorClassSlug = 'task' | 'prompt' | 'tool' | 'model' | 'harness';

interface RunOutcome {
  readonly taskId: string;
  readonly attempt: number;
  readonly errorClass: ErrorClassSlug;
  readonly errorClassUa: string;
  readonly traceId: string;
  readonly exitStatus: 'ok' | 'agent_failed' | 'timeout' | 'step_limit';
  readonly passed: boolean;
  readonly acceptanceDetail: string;
  readonly patchBytes: number;
  readonly stepsCount: number;
  readonly toolCallsCount: number;
  readonly toolErrorSeen: boolean;
  readonly durationS: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
  readonly note: string;
}

interface LangfuseObservation {
  readonly id: string;
  readonly traceId: string;
  readonly type: string;
  readonly name: string;
  readonly startTime: string;
  readonly endTime?: string | null;
  readonly latency?: number | null;
  readonly level?: string;
  readonly statusMessage?: string;
  readonly inputUsage?: number | null;
  readonly outputUsage?: number | null;
  readonly totalCost?: number | null;
  readonly projectId?: string;
  readonly metadata?: Record<string, unknown>;
}

const MODEL_ID = process.env.EVAL_MODEL ?? 'gemini-3.5-flash-lite';
const DATE_PREFIX = '2026-11-23';

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync('.env.local')) return out;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
    if (key) {
      out[key] = val;
      if (!process.env[key]) process.env[key] = val;
    }
  }
  return out;
}

function safeSandboxPath(root: string, rel: string): string {
  const abs = resolve(root, rel);
  const diff = relative(root, abs);
  if (diff.startsWith('..') || /\.env/i.test(diff)) {
    throw new Error(`Заборонений шлях (sandbox guard): ${rel}`);
  }
  return abs;
}

function createTools(root: string, acceptanceCmd: string | null) {
  let toolErrorSeen = false;
  let patchBytes = 0;
  const tools = {
    readFile: tool({
      description: 'Прочитати текстовий файл у межах робочої теки.',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        try {
          const abs = safeSandboxPath(root, path);
          if (!existsSync(abs)) {
            toolErrorSeen = true;
            throw new Error(`ENOENT: файл не знайдено: ${path}`);
          }
          return readFileSync(abs, 'utf8').slice(0, 8000);
        } catch (err) {
          toolErrorSeen = true;
          throw err;
        }
      },
    }),
    writeFile: tool({
      description: 'Записати файл у межах робочої теки.',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        try {
          const abs = safeSandboxPath(root, path);
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, content, 'utf8');
          patchBytes += Buffer.byteLength(content, 'utf8');
          return `written:${path}`;
        } catch (err) {
          toolErrorSeen = true;
          throw err;
        }
      },
    }),
    runChecks: tool({
      description: 'Запустити команду перевірки у робочій теці.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!acceptanceCmd) return { ok: true, output: 'no checks configured' };
        const r = spawnSync(acceptanceCmd, { cwd: root, encoding: 'utf8', shell: true, timeout: 20_000 });
        return {
          ok: (r.status ?? 1) === 0,
          exit: r.status ?? 1,
          output: `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().slice(-800),
        };
      },
    }),
    submitArtifact: tool({
      description: 'Завершити задачу та передати короткий підсумок.',
      inputSchema: z.object({ summary: z.string() }),
      execute: async ({ summary }) => ({ done: true, summary }),
    }),
  };
  return {
    tools,
    getToolErrorSeen: () => toolErrorSeen,
    getPatchBytes: () => patchBytes,
  };
}

async function runTracedScenario(opts: {
  taskId: string;
  attempt: number;
  errorClass: ErrorClassSlug;
  errorClassUa: string;
  prompt: string;
  sandboxRoot: string;
  acceptanceCmd: string | null;
  maxSteps: number;
  timeoutMs?: number;
  useHarnessStopLimit?: boolean;
  temperature?: number;
  note: string;
  apiKey: string;
}): Promise<RunOutcome> {
  const google = createGoogleGenerativeAI({ apiKey: opts.apiKey });
  const tracer = trace.getTracer('harness');
  const { tools, getToolErrorSeen, getPatchBytes } = createTools(opts.sandboxRoot, opts.acceptanceCmd);

  return tracer.startActiveSpan(`task ${opts.taskId}`, async (span) => {
    const traceId = span.spanContext().traceId;
    const started = Date.now();
    const timeout = opts.timeoutMs ? createTaskTimeout(opts.timeoutMs, opts.taskId) : null;
    let exitStatus: RunOutcome['exitStatus'] = 'ok';
    let stepsCount = 0;
    let toolCallsCount = 0;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let submitted = false;

    try {
      const stopRules = [
        opts.useHarnessStopLimit
          ? stepLimit(opts.maxSteps, opts.taskId)
          : isStepCount(opts.maxSteps),
        hasToolCall('submitArtifact'),
      ];

      const res = await generateText({
        model: google(MODEL_ID),
        temperature: opts.temperature ?? 0,
        prompt: opts.prompt,
        tools,
        stopWhen: stopRules,
        ...(timeout ? { abortSignal: timeout.signal } : {}),
        telemetry: {
          functionId: 'harness-error-analysis',
          recordInputs: false,
          recordOutputs: false,
        },
      });

      stepsCount = res.steps.length;
      toolCallsCount = res.steps.reduce((acc, s) => acc + s.toolCalls.length, 0);
      submitted = res.steps.some((s) => s.toolCalls.some((tc) => tc.toolName === 'submitArtifact'));
      inputTokens = res.totalUsage?.inputTokens ?? null;
      outputTokens = res.totalUsage?.outputTokens ?? null;

      if (opts.useHarnessStopLimit && !submitted) {
        exitStatus = 'step_limit';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (timeout?.signal.aborted || /abort|timeout/i.test(msg)) {
        exitStatus = 'timeout';
      } else {
        exitStatus = 'agent_failed';
      }
    } finally {
      timeout?.clear();
      span.end();
    }

    let accPassed = false;
    let acceptanceDetail = 'n/a';
    if (opts.acceptanceCmd) {
      const r = spawnSync(opts.acceptanceCmd, {
        cwd: opts.sandboxRoot,
        encoding: 'utf8',
        shell: true,
        timeout: 20_000,
      });
      accPassed = (r.status ?? 1) === 0;
      const errSnippet = `${r.stderr ?? ''} ${r.stdout ?? ''}`.replace(/[A-Za-z]:\\[^\s)]*/g, '<local-path>').replace(/\s+/g, ' ').trim().slice(0, 180);
      acceptanceDetail = `exit=${r.status ?? 1}${errSnippet ? ` (${errSnippet})` : ''}`;
    } else {
      accPassed = exitStatus === 'ok' && submitted;
      acceptanceDetail = `exit_status=${exitStatus}, submitted=${String(submitted)}`;
    }

    const durationS = Math.round((Date.now() - started) / 100) / 10;
    const costUsd =
      inputTokens !== null && outputTokens !== null
        ? Number(estimateCost('cheap', inputTokens, outputTokens).toFixed(6))
        : null;

    return {
      taskId: opts.taskId,
      attempt: opts.attempt,
      errorClass: opts.errorClass,
      errorClassUa: opts.errorClassUa,
      traceId,
      exitStatus,
      passed: exitStatus === 'ok' && accPassed,
      acceptanceDetail,
      patchBytes: getPatchBytes(),
      stepsCount,
      toolCallsCount,
      toolErrorSeen: getToolErrorSeen(),
      durationS,
      inputTokens,
      outputTokens,
      costUsd,
      note: opts.note,
    };
  });
}

async function fetchObservations(
  baseUrl: string,
  authHeader: string,
  traceId: string,
): Promise<LangfuseObservation[]> {
  const url = `${baseUrl}/api/public/v2/observations?fields=core,basic,usage,metadata&traceId=${traceId}&limit=50`;
  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(url, { headers: { Authorization: `Basic ${authHeader}` } });
    if (res.ok) {
      const json = (await res.json()) as { data?: LangfuseObservation[] };
      if (json.data && json.data.length > 0) {
        return json.data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return [];
}

function formatExtract(outcome: RunOutcome, obs: readonly LangfuseObservation[]): string {
  const lines: string[] = [];
  lines.push(`# Trace extract: ${outcome.taskId} (attempt ${outcome.attempt})`);
  lines.push(`date: ${DATE_PREFIX}`);
  lines.push(`class: ${outcome.errorClassUa} (${outcome.errorClass})`);
  lines.push(`trace_id: ${outcome.traceId}`);
  lines.push(`exit_status: ${outcome.exitStatus}`);
  lines.push(`passed: ${String(outcome.passed)}`);
  lines.push(`acceptance: ${outcome.acceptanceDetail}`);
  lines.push(`patch_bytes: ${outcome.patchBytes}`);
  lines.push(`steps_chat_local: ${outcome.stepsCount}`);
  lines.push(`tool_calls_local: ${outcome.toolCallsCount}`);
  lines.push(`tool_error_seen: ${String(outcome.toolErrorSeen)}`);
  lines.push(`duration_s: ${outcome.durationS}`);
  lines.push(`tokens: in=${outcome.inputTokens ?? 'n/a'} out=${outcome.outputTokens ?? 'n/a'}`);
  lines.push(`cost_usd_estimate: ${outcome.costUsd ?? 'n/a'}`);
  lines.push(`note: ${outcome.note}`);
  lines.push('record_inputs_outputs: disabled (metadata only, no local resourceAttributes)');
  lines.push('');
  lines.push(`## Observations from Langfuse v2 API (${obs.length})`);

  for (const o of obs) {
    const meta = o.metadata ?? {};
    const op = meta['attributes.gen_ai.operation.name'];
    const agent = meta['attributes.gen_ai.agent.name'];
    const provider = meta['attributes.gen_ai.provider.name'];
    const model = meta['attributes.gen_ai.request.model'];
    const finish = meta['attributes.gen_ai.response.finish_reasons'];
    const toolName = meta['attributes.gen_ai.tool.name'];
    const errType = meta['attributes.error.type'];
    const inTok = meta['attributes.gen_ai.usage.input_tokens'] ?? o.inputUsage;
    const outTok = meta['attributes.gen_ai.usage.output_tokens'] ?? o.outputUsage;

    const parts: string[] = [
      `[${o.type}] ${o.name}`,
      `latency=${o.latency ?? 'n/a'}s`,
      `level=${o.level ?? 'DEFAULT'}`,
    ];
    if (op) parts.push(`gen_ai.operation.name=${String(op)}`);
    if (agent) parts.push(`gen_ai.agent.name=${String(agent)}`);
    if (provider) parts.push(`gen_ai.provider.name=${String(provider)}`);
    if (model) parts.push(`gen_ai.request.model=${String(model)}`);
    if (toolName) parts.push(`gen_ai.tool.name=${String(toolName)}`);
    if (finish) parts.push(`gen_ai.response.finish_reasons=${JSON.stringify(finish)}`);
    if (errType) parts.push(`error.type=${String(errType)}`);
    if (o.statusMessage) parts.push(`statusMessage=${o.statusMessage.slice(0, 160)}`);
    if (inTok !== undefined && inTok !== null && inTok !== 0) parts.push(`in=${String(inTok)}`);
    if (outTok !== undefined && outTok !== null && outTok !== 0) parts.push(`out=${String(outTok)}`);
    if (o.totalCost !== undefined && o.totalCost !== null) parts.push(`cost=$${o.totalCost.toFixed(6)}`);
    lines.push(`- ${parts.join(' | ')}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const envMap = loadEnvLocal();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY не знайдено');

  const pk = envMap['LANGFUSE_PUBLIC_KEY'] ?? '';
  const sk = envMap['LANGFUSE_SECRET_KEY'] ?? '';
  const baseUrl = (envMap['LANGFUSE_BASE_URL'] || 'https://cloud.langfuse.com').replace(/\/$/, '');
  const authHeader = Buffer.from(`${pk}:${sk}`).toString('base64');

  initTelemetry();

  const sandbox = mkdtempSync(join(tmpdir(), 'lab3-err-'));
  const outcomes: RunOutcome[] = [];

  try {
    // --- 1. КЛАС "задача" (2 спроби на задачі зі зламаним acceptance) ---
    writeFileSync(join(sandbox, 'package.json'), '{"name":"sandbox","scripts":{"test":"echo ok"}}\n', 'utf8');
    for (const attempt of [1, 2]) {
      outcomes.push(
        await runTracedScenario({
          taskId: 'err-task-01',
          attempt,
          errorClass: 'task',
          errorClassUa: 'задача',
          prompt:
            'Прочитай package.json через readFile, запусти runChecks і заверши роботу через submitArtifact.',
          sandboxRoot: sandbox,
          acceptanceCmd: 'npm run nonexistent-acceptance-check',
          maxSteps: 4,
          note: 'Зламаний acceptance (неіснуючий npm-скрипт): усі спроби k=2 падають на тій самій команді.',
          apiKey,
        }),
      );
      await new Promise((r) => setTimeout(r, 1500));
    }

    // --- 2. КЛАС "промпт" (2 прогони: модель відповідає текстом без жодного execute_tool) ---
    outcomes.push(
      await runTracedScenario({
        taskId: 'err-prompt-01',
        attempt: 1,
        errorClass: 'prompt',
        errorClassUa: 'промпт',
        prompt: 'Поясни двома реченнями українською, навіщо в агентному харнесі потрібен circuit breaker. Не викликай інструменти.',
        sandboxRoot: sandbox,
        acceptanceCmd: 'node -e "const fs=require(\'node:fs\'); if(!fs.existsSync(\'circuit-note.md\')) process.exit(1)"',
        maxSteps: 3,
        note: 'Нечіткий промпт без вимоги записати файл: модель відповіла текстом (finish_reasons=["stop"]), 0 execute_tool, порожній patch.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-prompt-02',
        attempt: 1,
        errorClass: 'prompt',
        errorClassUa: 'промпт',
        prompt: 'Опиши одним абзацом різницю між regression і edge задачами в оцінюванні агентів. Не викликай жодних інструментів.',
        sandboxRoot: sandbox,
        acceptanceCmd: 'node -e "const fs=require(\'node:fs\'); if(!fs.existsSync(\'buckets-note.md\')) process.exit(1)"',
        maxSteps: 3,
        note: 'Промпт просить текстове пояснення замість дії: немає спанів execute_tool, порожній patch, acceptance не пройдено.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    // --- 3. КЛАС "інструмент" (2 прогони: реальна помилка всередині execute_tool) ---
    outcomes.push(
      await runTracedScenario({
        taskId: 'err-tool-01',
        attempt: 1,
        errorClass: 'tool',
        errorClassUa: 'інструмент',
        prompt: 'Обовʼязково виклич readFile для шляху ".env.local", щоб прочитати конфіг, потім виклич submitArtifact.',
        sandboxRoot: sandbox,
        acceptanceCmd: 'node -e "const fs=require(\'node:fs\'); if(!fs.existsSync(\'env-copy.txt\')) process.exit(1)"',
        maxSteps: 4,
        note: 'readFile кинув виняток sandbox guard на шляху .env.local -> у спані execute_tool зафіксовано помилку.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-tool-02',
        attempt: 1,
        errorClass: 'tool',
        errorClassUa: 'інструмент',
        prompt: 'Обовʼязково виклич readFile для шляху "missing/config.json", і якщо буде помилка — спробуй ще раз readFile для "missing/config.json", потім заверши.',
        sandboxRoot: sandbox,
        acceptanceCmd: 'node -e "const fs=require(\'node:fs\'); if(!fs.existsSync(\'config-summary.txt\')) process.exit(1)"',
        maxSteps: 4,
        note: 'readFile кинув ENOENT у спані execute_tool; модель повторила виклик того самого інструмента.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    // --- 4. КЛАС "харнес" (2 прогони: stepLimit і taskTimeout із src/harness/stop.ts) ---
    writeFileSync(join(sandbox, 'a.txt'), 'file A\n', 'utf8');
    writeFileSync(join(sandbox, 'b.txt'), 'file B\n', 'utf8');
    writeFileSync(join(sandbox, 'c.txt'), 'file C\n', 'utf8');
    writeFileSync(join(sandbox, 'd.txt'), 'file D\n', 'utf8');
    const sequentialPrompt = [
      'Виконуй РІВНО один виклик інструмента за крок:',
      '1) readFile для a.txt',
      '2) readFile для b.txt',
      '3) readFile для c.txt',
      '4) readFile для d.txt',
      '5) тільки після читання всіх 4 файлів виклич submitArtifact.',
    ].join('\n');

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-harness-01',
        attempt: 1,
        errorClass: 'harness',
        errorClassUa: 'харнес',
        prompt: sequentialPrompt,
        sandboxRoot: sandbox,
        acceptanceCmd: null,
        maxSteps: 2,
        useHarnessStopLimit: true,
        note: 'Зупинка stepLimit(2) із src/harness/stop.ts: 2 спани chat, запис у docs/lab3/stop-log.jsonl, без submitArtifact.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-harness-02',
        attempt: 1,
        errorClass: 'harness',
        errorClassUa: 'харнес',
        prompt: sequentialPrompt,
        sandboxRoot: sandbox,
        acceptanceCmd: null,
        maxSteps: 6,
        timeoutMs: 1400,
        useHarnessStopLimit: true,
        note: 'Зупинка createTaskTimeout(1400ms) із src/harness/stop.ts: exit_status=timeout, запис у docs/lab3/stop-log.jsonl.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    // --- 5. КЛАС "модель" (2–3 кандидати зі складними крайовими умовами при справних інструментах) ---
    writeFileSync(
      join(sandbox, 'evalExpr.mjs'),
      'export function evalExpr(s) {\n  return Number(s);\n}\n',
      'utf8',
    );
    const exprCheck =
      'node -e "import(\'./evalExpr.mjs\').then(({evalExpr})=>{const cases=[[\'2+3*4\',14],[\'(2+3)*4\',20],[\'-5+2\',-3],[\'10-3-2\',5],[\'-7/2\',-3],[\'2^3^2\',512],[\'--4\',4],[\'2*-3\',-6]]; for(const [i,e] of cases){const g=evalExpr(i); if(g!==e){console.error(i,g,e); process.exit(1);}}})"';

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-model-01',
        attempt: 1,
        errorClass: 'model',
        errorClassUa: 'модель',
        prompt:
          'Прочитай evalExpr.mjs, реалізуй у ньому evalExpr(s) (оператори +, -, *, / з усіченням до нуля, правоасоціативний ^, унарний мінус, дужки; без eval/Function) одним writeFile, потім одразу виклич submitArtifact (не запускай runChecks).',
        sandboxRoot: sandbox,
        acceptanceCmd: exprCheck,
        maxSteps: 3,
        temperature: 0.7,
        note: 'Інструменти і задача справні, але модель помилилася в реалізації пріоритетів/правоасоціативності/унарного мінуса без самоперевірки.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    writeFileSync(
      join(sandbox, 'semverSort.mjs'),
      'export function sortSemver(list) {\n  return [...list].sort();\n}\n',
      'utf8',
    );
    const semverCheck =
      'node -e "import(\'./semverSort.mjs\').then(({sortSemver})=>{const inp=[\'1.0.0-alpha\',\'1.0.0-alpha.1\',\'1.0.0-alpha.beta\',\'1.0.0-beta\',\'1.0.0-beta.2\',\'1.0.0-beta.11\',\'1.0.0-rc.1\',\'1.0.0\',\'1.0.0+build.1\',\'1.0.0-1\',\'1.0.0-10\',\'1.0.0-2\']; const exp=[\'1.0.0-1\',\'1.0.0-2\',\'1.0.0-10\',\'1.0.0-alpha\',\'1.0.0-alpha.1\',\'1.0.0-alpha.beta\',\'1.0.0-beta\',\'1.0.0-beta.2\',\'1.0.0-beta.11\',\'1.0.0-rc.1\',\'1.0.0\',\'1.0.0+build.1\']; const got=sortSemver([...inp].reverse()); if(JSON.stringify(got)!==JSON.stringify(exp)){console.error(got); process.exit(1);}})"';

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-model-02',
        attempt: 1,
        errorClass: 'model',
        errorClassUa: 'модель',
        prompt:
          'Прочитай semverSort.mjs, реалізуй у ньому повне сортування SemVer 2.0.0 (включно з числовими і рядковими prerelease-ідентифікаторами та збереженням відносного порядку для версій, що відрізняються лише build metadata після +) одним writeFile, потім одразу виклич submitArtifact.',
        sandboxRoot: sandbox,
        acceptanceCmd: semverCheck,
        maxSteps: 3,
        temperature: 0.7,
        note: 'Інструменти і задача справні, але модель помилилася в правилах порівняння SemVer 2.0.0 prerelease/build.',
        apiKey,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));

    writeFileSync(
      join(sandbox, 'csvParse.mjs'),
      'export function parseCsv(text) {\n  return text.split(\'\\n\').map((l) => l.split(\',\'));\n}\n',
      'utf8',
    );
    const csvCheck =
      'node -e "import(\'./csvParse.mjs\').then(({parseCsv})=>{const got=parseCsv(\'a,\\"b,\\\\\\"c\\\\\\"\\",\\"d\\ne\\"\\r\\n1,\\"\\"\\"x\\"\\"\\",3\'); const exp=[[\'a\',\'b,\\\\\\"c\\\\\\"\',\'d\\ne\'],[\'1\',\'\\"x\\"\',\'3\']]; if(JSON.stringify(got)!==JSON.stringify(exp)){console.error(got); process.exit(1);}})"';

    outcomes.push(
      await runTracedScenario({
        taskId: 'err-model-03',
        attempt: 1,
        errorClass: 'model',
        errorClassUa: 'модель',
        prompt:
          'Прочитай csvParse.mjs, реалізуй RFC 4180 parseCsv(text) з підтримкою переносів рядків усередині лапок, CRLF і екранованих подвійних лапок "" одним writeFile, потім одразу виклич submitArtifact.',
        sandboxRoot: sandbox,
        acceptanceCmd: csvCheck,
        maxSteps: 3,
        temperature: 0.7,
        note: 'Запасний кандидат класу модель: перевірка обробки лапок і переносів рядків у CSV.',
        apiKey,
      }),
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
    await shutdownTelemetry();
  }

  console.log('\nОчікуємо 4с на ingestion у Langfuse і вивантажуємо текстові витяжки...');
  await new Promise((r) => setTimeout(r, 4000));

  mkdirSync('docs/lab3/traces', { recursive: true });
  mkdirSync('.harness', { recursive: true });

  const failedOnly = outcomes.filter((o) => !o.passed);
  const summaryRows: Array<RunOutcome & { extractFile: string; screenshotFile: string; langfuseUrl: string; obsCount: number; chatSpans: number; finishReasons: string[]; errTypes: string[] }> = [];

  for (const o of failedOnly) {
    const obs = await fetchObservations(baseUrl, authHeader, o.traceId);
    const baseName = `${DATE_PREFIX}-${o.errorClass}-${o.traceId}`;
    const extractFile = `docs/lab3/traces/${baseName}.txt`;
    const screenshotFile = `docs/lab3/traces/${baseName}.png`;
    writeFileSync(extractFile, formatExtract(o, obs), 'utf8');

    const projectId = obs[0]?.projectId ?? 'cmwhv1h6w01tzad0hxha0i5r0';
    const chatSpans = obs.filter((x) => x.metadata?.['attributes.gen_ai.operation.name'] === 'chat').length;
    const finishReasons = [
      ...new Set(
        obs.flatMap((x) => {
          const f = x.metadata?.['attributes.gen_ai.response.finish_reasons'];
          return Array.isArray(f) ? f.map(String) : [];
        }),
      ),
    ];
    const errTypes = [
      ...new Set(
        obs
          .map((x) => x.metadata?.['attributes.error.type'])
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      ),
    ];

    summaryRows.push({
      ...o,
      extractFile,
      screenshotFile,
      langfuseUrl: `${baseUrl}/project/${projectId}/traces/${o.traceId}`,
      obsCount: obs.length,
      chatSpans,
      finishReasons,
      errTypes,
    });
  }

  writeFileSync('.harness/error-traces-summary.json', `${JSON.stringify({ all: outcomes, failed: summaryRows }, null, 2)}\n`, 'utf8');

  console.log(`\nУсього прогонів: ${outcomes.length}, невдалих (у класифікацію): ${failedOnly.length}`);
  console.table(
    summaryRows.map((r) => ({
      task: r.taskId,
      att: r.attempt,
      class: r.errorClassUa,
      exit: r.exitStatus,
      obs: r.obsCount,
      chat: r.chatSpans,
      tools: r.toolCallsCount,
      inTok: r.inputTokens,
      outTok: r.outputTokens,
      trace: r.traceId.slice(0, 12),
    })),
  );

  console.log('\n=== Посилання та імена файлів для скріншотів ===');
  for (const r of summaryRows) {
    console.log(`${r.taskId} [${r.errorClassUa}] -> ${r.screenshotFile}`);
    console.log(`  URL: ${r.langfuseUrl}`);
  }
}

main();
