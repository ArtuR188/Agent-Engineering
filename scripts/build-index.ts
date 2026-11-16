/**
 * Побудова індексу (крок 04).
 *   npm run index                        — хмарний Gemini (типово для проєкту, ключ у .env.local)
 *   npm run index -- --provider google   — явно хмарний Gemini
 *   npm run index -- --provider ollama   — локальна Ollama (embeddinggemma-2:270m)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { performance } from 'node:perf_hooks';

import { chunkDocument, normalize, RULE } from '../src/rag/chunk';
import { geminiEmbedder, ollamaEmbedder, type Embedder } from '../src/rag/embed';
import { round6, saveIndex, sha256, type IndexedChunk, type IndexFile } from '../src/rag/store';

try {
  process.loadEnvFile?.('.env.local');
} catch {
  // .env.local може бути відсутнім у CI
}

const CORPUS = 'corpus';
const OUT = 'data/index.json';
const NORMALIZATION = 'BOM прибрано, CRLF→LF, пробіли в кінці рядків прибрано';

async function main(): Promise<void> {
  const providerArg = process.argv.includes('--provider')
    ? process.argv[process.argv.indexOf('--provider') + 1]
    : 'google';

  const embedder: Embedder =
    providerArg === 'ollama' ? ollamaEmbedder() : geminiEmbedder(768);

  const started = performance.now();
  const documents: IndexFile['documents'] = [];
  const chunks: IndexedChunk[] = [];

  const files = readdirSync(CORPUS)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .sort();
  if (files.length < 10) {
    throw new Error(`у ${CORPUS}/ лише ${files.length} файлів, специфікація вимагає 10–40`);
  }

  for (const file of files) {
    const docId = file.replace(/\.(md|txt)$/i, '');
    const text = normalize(readFileSync(join(CORPUS, file), 'utf8'));
    const parts = chunkDocument(docId, text, RULE);
    const vectors = await embedder.embedDocuments(parts.map((p) => p.text));
    parts.forEach((part, i) => {
      const vec = vectors[i];
      if (!vec) throw new Error(`Відсутній вектор для фрагмента ${part.id}`);
      chunks.push({ ...part, vector: vec.map(round6) });
    });
    documents.push({
      id: docId,
      path: posix.join(CORPUS, file),
      chars: text.length,
      sha256: sha256(text),
    });
    console.log(`  ${docId}: ${text.length} симв. → ${parts.length} фрагм.`);
  }

  saveIndex(OUT, {
    version: 1,
    builtAt: new Date().toISOString(),
    embedder: embedder.id,
    dimensions: embedder.dimensions,
    rule: RULE,
    normalization: NORMALIZATION,
    documents,
    chunks,
  });

  const seconds = (performance.now() - started) / 1000;
  const lengths = chunks.map((c) => c.text.length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
  const minLen = lengths[0] ?? 0;
  const maxLen = lengths[lengths.length - 1] ?? 0;
  console.log(`
документів:    ${documents.length}
фрагментів:    ${chunks.length}
довжина:       медіана ${median}, мін ${minLen}, макс ${maxLen} симв.
ембедер:       ${embedder.id}, ${embedder.dimensions} вимірів
${OUT}:        ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} МБ
час побудови:  ${seconds.toFixed(1)} с
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
