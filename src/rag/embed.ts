/**
 * ЕМБЕДІНГИ (крок 04): два шляхи за $0 і підробка для тестів.
 */
import { embed, embedMany } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  embedDocuments(texts: readonly string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

// ---------- Шлях А: локальна Ollama ----------

export function ollamaEmbedder(model = 'embeddinggemma-2:270m', dimensions = 768): Embedder {
  const base = process.env.OLLAMA_URL ?? 'http://localhost:11434';

  const call = async (input: readonly string[]): Promise<number[][]> => {
    const res = await fetch(`${base}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, input, dimensions, truncate: false }),
    });
    if (!res.ok) throw new Error(`/api/embed ${res.status}: ${await res.text()}`);
    const data: unknown = await res.json();
    const vectors = (data as { embeddings?: unknown }).embeddings;
    if (!Array.isArray(vectors) || vectors.length !== input.length) {
      throw new Error(`/api/embed: очікував ${input.length} векторів, прийшло інше`);
    }
    for (const v of vectors as number[][]) {
      if (v.length !== dimensions) {
        throw new Error(`/api/embed: розмірність ${v.length}, очікував ${dimensions}`);
      }
    }
    return vectors as number[][];
  };

  return {
    id: `ollama:${model}`,
    dimensions,
    embedDocuments: call,
    embedQuery: async (text) => {
      const rows = await call([text]);
      const first = rows[0];
      if (!first) throw new Error("/api/embed: порожня відповідь");
      return first;
    },
  };
}

// ---------- Шлях Б: Gemini через AI SDK ----------

function resolveGoogleKey(): string {
  const k1 = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  const k2 = (process.env.GEMINI_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (k1 && !k1.startsWith('AIzaSy...')) return k1;
  return k2 || k1;
}

export function geminiEmbedder(
  dimensions = 768,
  modelName: string = process.env.GEMINI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001',
): Embedder {
  const google = createGoogleGenerativeAI({ apiKey: resolveGoogleKey() });
  const model = google.textEmbedding(modelName);

  const normalizeVec = (vec: number[]): number[] => {
    const sliced = vec.length > dimensions ? vec.slice(0, dimensions) : vec;
    const norm = Math.hypot(...sliced) || 1;
    return sliced.map((x) => x / norm);
  };

  return {
    id: `google:${modelName}@${dimensions}`,
    dimensions,
    embedDocuments: async (texts) => {
      const { embeddings, usage } = await embedMany({
        model,
        values: [...texts],
        maxParallelCalls: 2,
        providerOptions: {
          google: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: dimensions },
        },
      });
      const tokInfo = Number.isFinite(usage?.tokens) ? `${usage.tokens} токенів` : `${dimensions} вимірів`;
      console.error(`  embedMany: ${texts.length} фрагментів (${tokInfo})`);
      return embeddings.map(normalizeVec);
    },
    embedQuery: async (text) => {
      const { embedding } = await embed({
        model,
        value: text,
        providerOptions: {
          google: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: dimensions },
        },
      });
      return normalizeVec(embedding);
    },
  };
}

// ---------- Підробка для тестів: детерміновано, без мережі ----------

export function fakeEmbedder(dimensions = 64): Embedder {
  const vector = (text: string): number[] => {
    const v = new Array<number>(dimensions).fill(0);
    for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
      let h = 2166136261;
      for (let i = 0; i < word.length; i += 1) {
        h ^= word.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const bucket = Math.abs(h) % dimensions;
      v[bucket] = (v[bucket] ?? 0) + 1;
    }
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  };

  return {
    id: `fake:fnv@${dimensions}`,
    dimensions,
    embedDocuments: async (texts) => texts.map(vector),
    embedQuery: async (text) => vector(text),
  };
}
