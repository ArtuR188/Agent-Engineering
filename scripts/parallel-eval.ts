/**
 * Вимір паралельності (крок 07). ХОДИТЬ У МЕРЕЖУ — запускається вручну:
 *   npx tsx --env-file=.env.local scripts/parallel-eval.ts 1    «до»: послідовно
 *   npx tsx --env-file=.env.local scripts/parallel-eval.ts 4    «після»: чотири гілки
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { chatCompletionsModel } from "../src/agent/adapters";
import { CATALOG } from "../src/models";
import { geminiEmbedder } from "../src/rag/embed";
import { bm25From, hybridSearch } from "../src/rag/search";
import { loadIndex } from "../src/rag/store";
import { renderContext } from "../src/rag/cite";
import type { Hit } from "../src/metrics";

try { process.loadEnvFile?.(".env.local"); } catch {}

export interface Budget {
  readonly maxBranches: number;
  readonly maxTokens: number;
  readonly maxWallMs: number;
}

export const BUDGET: Budget = { maxBranches: 4, maxTokens: 200_000, maxWallMs: 10 * 60_000 };

export interface BranchResult {
  readonly id: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly ms: number;
}

export async function runPool<T>(
  tasks: readonly (() => Promise<T>)[],
  budget: Budget,
  spentTokens: () => number,
): Promise<{ results: (T | Error)[]; stoppedEarly: boolean }> {
  const results: (T | Error)[] = new Array(tasks.length);
  const startedAt = performance.now();
  let next = 0;
  let stoppedEarly = false;

  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      if (spentTokens() >= budget.maxTokens || performance.now() - startedAt >= budget.maxWallMs) {
        stoppedEarly = true;
        return;
      }
      const i = next++;
      try {
        results[i] = await tasks[i]!();
      } catch (error) {
        results[i] = error instanceof Error ? error : new Error(String(error));
      }
    }
  };

  const width = Math.max(1, Math.min(budget.maxBranches, tasks.length));
  await Promise.all(Array.from({ length: width }, worker));
  return { results, stoppedEarly };
}

const K = 5;
const OUT = "docs/lab2/parallel-run.json";
interface Entry { id: string; query: string; must_cite: string[] }

const width = Number(process.argv[2] ?? 1);
const budget: Budget = { ...BUDGET, maxBranches: Number.isFinite(width) ? width : 1 };

const entries: Entry[] = readFileSync("docs/lab2/golden/queries.jsonl", "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line) as Entry);

const SYSTEM_PROMPT =
  "Ти — внутрішній довідковий асистент батутного залу «ZeroGravity Gym». " +
  "Відповідай коротко (1–2 речення) українською мовою, називаючи лише точні тарифи, коди й норми. " +
  "Якщо точних даних цього залу у тебе немає, прямо скажи: «Інформації немає в документах залу».";

const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const spec = CATALOG["gemini-3.5-flash-lite"];
const callModel = chatCompletionsModel({
  url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  model: spec.id,
  headers: { authorization: `Bearer ${geminiKey?.trim().replace(/^["']|["']$/g, "")}` },
});

const embedder = geminiEmbedder(768);
const index = loadIndex("data/index.json", embedder);
const words = bm25From(index);

let spent = 0;

const tasks = entries.map((entry) => async (): Promise<BranchResult> => {
  const started = performance.now();
  const rawHits = await hybridSearch(index, words, embedder, entry.query, K);
  const ctx = renderContext(rawHits.map((h) => h.chunk));
  const promptText = `Контекст з документів залу:\n${ctx}\n\nОбов'язково вказуй у відповіді [doc-XX#NNNN].\n\nЗапит: ${entry.query}`;
  
  const res = await callModel(SYSTEM_PROMPT, [{ role: "user", text: promptText }], []);
  
  const inputTokens = res.usage.inputTokens ?? 0;
  const outputTokens = res.usage.outputTokens ?? 0;
  spent += inputTokens + outputTokens;
  
  return { id: entry.id, inputTokens, outputTokens, ms: Math.round(performance.now() - started) };
});

const wallStart = performance.now();
const { results, stoppedEarly } = await runPool(tasks, budget, () => spent);
const wallMs = Math.round(performance.now() - wallStart);

const ok = results.filter((r): r is BranchResult => !(r instanceof Error));
const failed = results.filter((r): r is Error => r instanceof Error);
const sumBranchMs = ok.reduce((n, r) => n + r.ms, 0);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ runAt: new Date().toISOString(), budget, wallMs, sumBranchMs, inputTokens: ok.reduce((n, r) => n + r.inputTokens, 0), outputTokens: ok.reduce((n, r) => n + r.outputTokens, 0), done: ok.length, failed: failed.map((e) => e.message), stoppedEarly, branches: ok }, null, 2)}\n`,
  "utf8",
);

console.log({ width: budget.maxBranches, wallMs, sumBranchMs, done: ok.length, failed: failed.length, stoppedEarly });