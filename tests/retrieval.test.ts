import { describe, expect, it } from 'vitest';

import { buildBm25, searchBm25, tokenize } from '../src/rag/bm25';
import { renderCitation, toCitation, validateAnswer, validateCitations } from '../src/rag/cite';
import { fakeEmbedder } from '../src/rag/embed';
import { rrf } from '../src/rag/rrf';
import { bm25From, hybridSearch, shouldRefuse } from '../src/rag/search';
import type { IndexedChunk, IndexFile } from '../src/rag/store';

describe('bm25', () => {
  const docs = [
    { id: 'c-1', text: 'Помилка E-418 означає, що формат заявки не підтримується.' },
    { id: 'c-2', text: 'Відмова у реєстрації оскаржується протягом тридцяти днів.' },
    { id: 'c-3', text: 'Заявка подається через особистий кабінет.' },
  ];
  const index = buildBm25(docs);

  it('бачить кирилицю', () => {
    expect(tokenize('Помилка E-418')).toEqual(['помилка', '418']);
  });

  it('знаходить рідкісний точний рядок', () => {
    const res = searchBm25(index, 'E-418');
    expect(res[0]?.id).toBe('c-1');
  });

  it('нічого не повертає, коли спільних слів немає', () => {
    expect(searchBm25(index, 'куди звертатися після відхилення')).toEqual([]);
  });
});

describe('rrf', () => {
  it('той самий розбір, що в методичці', () => {
    const fused = rrf([
      ['A', 'B', 'C'],
      ['C', 'A', 'D'],
    ]);
    expect(fused.map((r) => r.id)).toEqual(['A', 'C', 'B', 'D']);
    expect(fused[0]!.score).toBeCloseTo(1 / 61 + 1 / 62, 10);
    expect(fused[1]!.score).toBeCloseTo(1 / 63 + 1 / 61, 10);
    expect(fused[2]!.score).toBeCloseTo(1 / 62, 10);
    expect(fused[3]!.score).toBeCloseTo(1 / 63, 10);
    expect(fused[0]!.score).toBeGreaterThan(fused[1]!.score);
  });

  it('ранги рахуються з одиниці', () => {
    expect(rrf([['A']])[0]!.score).toBeCloseTo(1 / 61, 10);
  });

  it('відсутній у списку документ не додає нічого', () => {
    expect(rrf([['A', 'B'], ['A']]).find((r) => r.id === 'B')!.score).toBeCloseTo(1 / 62, 10);
  });
});

describe('validateAnswer та validateCitations', () => {
  const served: IndexedChunk[] = [
    {
      id: 'doc-03#0004',
      docId: 'doc-03',
      heading: 'Правила › Глибина ями',
      start: 10,
      end: 85,
      text: 'Мінімальна глибина поролонової ями становить 2.4 м (1800 кубів).',
      vector: [1, 0],
    },
  ];

  it('ловить відповідь без цитати', () => {
    expect(validateAnswer('Глибина становить 2.4 м.', served).join(' ')).toContain(
      'немає жодної цитати',
    );
  });

  it('ловить цитату на невидане', () => {
    expect(validateAnswer('Глибина 2.4 м [doc-99#0001].', served).join(' ')).toContain(
      'не давали',
    );
  });

  it('приймає цитату на видане', () => {
    expect(validateAnswer('Глибина 2.4 м [doc-03#0004].', served)).toEqual([]);
  });

  it('перевіряє дослівне входження quote у текст фрагмента та формат renderCitation', () => {
    const validCit = toCitation(served[0]!, '2.4 м (1800 кубів)');
    expect(validateCitations([validCit], served)).toEqual([]);
    expect(renderCitation(validCit)).toBe(
      '[doc-03#0004] doc-03 › Правила › Глибина ями · символи 10–85',
    );

    const fakeQuoteCit = toCitation(served[0]!, 'вигаданий уривок якого немає');
    expect(validateCitations([fakeQuoteCit], served).join(' ')).toContain(
      'не знайдено дослівно',
    );
  });
});

describe('hybridSearch на мінікорпусі з підробленим ембедером (без мережі)', () => {
  it('поєднує векторну і словесну гілки та обчислює shouldRefuse за cosine', async () => {
    const embedder = fakeEmbedder(64);
    const rawChunks = [
      {
        id: 'doc-01#0001',
        docId: 'doc-01',
        heading: 'Тарифи › Pro-Flip',
        start: 0,
        end: 62,
        text: 'Місячний абонемент Pro-Flip коштує 1650 грн на 30 днів.',
      },
      {
        id: 'doc-04#0001',
        docId: 'doc-04',
        heading: 'Турнікети › T-204',
        start: 0,
        end: 74,
        text: 'Помилка T-204 означає розряд акумулятора, використайте ключ SK-09.',
      },
      {
        id: 'doc-08#0001',
        docId: 'doc-08',
        heading: 'Аптечки › Сектор Б',
        start: 0,
        end: 65,
        text: 'Охолоджувальний спрей CryoFast лежить біля колони B4, код 4812.',
      },
    ];
    const vectors = await embedder.embedDocuments(rawChunks.map((c) => c.text));
    const chunks: IndexedChunk[] = rawChunks.map((c, i) => ({
      ...c,
      vector: vectors[i]!,
    }));

    const miniIndex: IndexFile = {
      version: 1,
      builtAt: '2026-11-16T00:00:00.000Z',
      embedder: embedder.id,
      dimensions: embedder.dimensions,
      rule: { maxChars: 900, minChars: 180, overlapChars: 90 },
      normalization: 'LF',
      documents: [],
      chunks,
    };

    const words = bm25From(miniIndex);
    const hits = await hybridSearch(miniIndex, words, embedder, 'помилка T-204 ключ SK-09', 3);

    expect(hits[0]?.chunk.id).toBe('doc-04#0001');
    expect(hits[0]?.rankVector).toBe(1);
    expect(hits[0]?.rankWords).toBe(1);
    expect(shouldRefuse(hits, 0.2).refuse).toBe(false);

    const unanswerableHits = await hybridSearch(
      miniIndex,
      words,
      embedder,
      'температура води басейну шапочка',
      3,
    );
    expect(shouldRefuse(unanswerableHits, 0.2).refuse).toBe(true);
  });
});
