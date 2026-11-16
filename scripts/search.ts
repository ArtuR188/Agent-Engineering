/**
 * CLI гібридного пошуку (крок 05):
 *   npx tsx scripts/search.ts "<запит>"
 *   npx tsx scripts/search.ts "<запит>" --explain
 */
import { cosineSimilarity } from 'ai';

import { searchBm25 } from '../src/rag/bm25';
import { renderCitation, toCitation } from '../src/rag/cite';
import { geminiEmbedder, ollamaEmbedder, type Embedder } from '../src/rag/embed';
import { rrf, RRF_K } from '../src/rag/rrf';
import { bm25From, DEPTH, hybridSearch, shouldRefuse } from '../src/rag/search';
import { loadIndex } from '../src/rag/store';

try {
  process.loadEnvFile?.('.env.local');
} catch {
  // ігноруємо відсутність .env.local
}

const INDEX_PATH = 'data/index.json';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const explain = args.includes('--explain');
  const useOllama =
    args.includes('--provider') && args[args.indexOf('--provider') + 1] === 'ollama';
  const queryParts = args.filter(
    (a, idx) => a !== '--explain' && a !== '--provider' && args[idx - 1] !== '--provider',
  );
  const query = queryParts.join(' ').trim();

  if (!query) {
    throw new Error('Використання: npx tsx scripts/search.ts "<запит>" [--explain]');
  }

  const embedder: Embedder = useOllama ? ollamaEmbedder() : geminiEmbedder(768);
  const index = loadIndex(INDEX_PATH, embedder);
  const words = bm25From(index);

  if (explain) {
    const qv = await embedder.embedQuery(query);
    const vecRanked = index.chunks
      .map((c) => ({ id: c.id, score: cosineSimilarity(qv, c.vector) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, DEPTH);

    const bm25Ranked = searchBm25(words, query, DEPTH);
    const rrfRanked = rrf(
      [vecRanked.map((r) => r.id), bm25Ranked.map((r) => r.id)],
      RRF_K,
    ).slice(0, 10);

    console.log(`Запит: "${query}"`);
    console.log(
      'вектор (cosine)'.padEnd(28) +
        'слова (BM25)'.padEnd(28) +
        `RRF (k=${RRF_K})`,
    );
    const rows = Math.max(5, Math.min(10, rrfRanked.length));
    for (let i = 0; i < rows; i++) {
      const v = vecRanked[i];
      const w = bm25Ranked[i];
      const f = rrfRanked[i];
      const vCol = v ? `${String(i + 1).padStart(2)}  ${v.id.padEnd(11)} ${v.score.toFixed(4)}` : '';
      const wCol = w
        ? `${String(i + 1).padStart(2)}  ${w.id.padEnd(11)} ${w.score.toFixed(2)}`
        : i === 0 && bm25Ranked.length === 0
          ? 'порожньо (0 збігів)'
          : '';
      const fCol = f ? `${String(i + 1).padStart(2)}  ${f.id.padEnd(11)} ${f.score.toFixed(5)}` : '';
      console.log(vCol.padEnd(28) + wCol.padEnd(28) + fCol);
    }
    console.log('');
  }

  const hits = await hybridSearch(index, words, embedder, query, 5);
  const refusal = shouldRefuse(hits);

  for (const [idx, h] of hits.entries()) {
    const firstLine =
      h.chunk.text
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0 && !l.startsWith('#')) ?? h.chunk.text.slice(0, 80).trim();
    const cite = renderCitation(toCitation(h.chunk, firstLine));
    console.log(
      `#${idx + 1} ${cite} | rrf=${h.rrf.toFixed(5)} cosine=${h.cosine.toFixed(4)} rankVec=${h.rankVector ?? 'немає'} rankWords=${h.rankWords ?? 'немає'}`,
    );
    console.log(`   Уривок: "${firstLine.slice(0, 120)}"`);
  }

  if (refusal.refuse) {
    console.log(`\nВІДМОВА (unanswerable): ${refusal.reason}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
