import { describe, expect, it } from 'vitest';
import {
  evaluateSingleCriterion,
  parseSpecCriteria,
  sanitizeDiff,
  type SpecCriterion,
} from '../scripts/verify';
import { criterionVerdict, isBlocked, verifyReport } from '../src/verify/schema';

const C1: SpecCriterion = {
  id: 'A1',
  statement: 'Усі тести проходять',
  checker: 'npm test',
};

describe('src/verify/schema', () => {
  it('приймає валідні вердикти pass, fail, unknown', () => {
    const report = verifyReport.parse({
      results: [
        { id: 'A1', verdict: 'pass', reason: 'Тести проходять', evidence: 'tests/validate-golden.test.ts:1' },
        { id: 'A2', verdict: 'fail', reason: 'Відсутній файл', evidence: 'docs/lab2/baseline.md' },
        { id: 'A3', verdict: 'unknown', reason: 'У diff немає даних', evidence: '' },
      ],
    });
    expect(report.results).toHaveLength(3);
    expect(isBlocked(report)).toBe(true);
  });

  it('не блокує при pass і unknown без fail', () => {
    const report = verifyReport.parse({
      results: [
        { id: 'A1', verdict: 'pass', reason: 'Ок', evidence: 'package.json:1' },
        { id: 'A2', verdict: 'unknown', reason: 'Немає у diff', evidence: '' },
      ],
    });
    expect(isBlocked(report)).toBe(false);
  });

  it('вимагає порожній evidence для unknown і непорожній для pass/fail', () => {
    expect(
      criterionVerdict.safeParse({
        id: 'A1',
        verdict: 'unknown',
        reason: 'Немає у diff',
        evidence: 'src/a.ts:1',
      }).success,
    ).toBe(false);

    expect(
      criterionVerdict.safeParse({
        id: 'A1',
        verdict: 'pass',
        reason: 'Є доказ',
        evidence: '',
      }).success,
    ).toBe(false);
  });

  it('відхиляє дублікати id, невідомий verdict або зайві поля', () => {
    expect(
      verifyReport.safeParse({
        results: [
          { id: 'A1', verdict: 'pass', reason: 'Ок', evidence: 'a.ts:1' },
          { id: 'A1', verdict: 'pass', reason: 'Дублікат', evidence: 'a.ts:2' },
        ],
      }).success,
    ).toBe(false);

    expect(
      criterionVerdict.safeParse({
        id: 'A1',
        verdict: 'maybe',
        reason: 'Тест',
        evidence: '',
      }).success,
    ).toBe(false);

    expect(
      criterionVerdict.safeParse({
        id: 'A1',
        verdict: 'pass',
        reason: 'Тест',
        evidence: 'a.ts:1',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('відхиляє порожній масив results', () => {
    expect(verifyReport.safeParse({ results: [] }).success).toBe(false);
  });
});

describe('scripts/verify', () => {
  it('парсить критерії A1..AN зі спеки', () => {
    const spec = [
      '## 6. Критерії приймання',
      '| # | Критерій | Перевірка |',
      '| --- | --- | --- |',
      '| A1 | Тести зелені | npm test |',
      '| A2 | Набір валідний | npx tsx scripts/validate-golden.ts |',
    ].join('\n');
    const items = parseSpecCriteria(spec);
    expect(items).toEqual([
      { id: 'A1', statement: 'Тести зелені', checker: 'npm test' },
      { id: 'A2', statement: 'Набір валідний', checker: 'npx tsx scripts/validate-golden.ts' },
    ]);
  });

  it('видаляє .env.local із diff і маскує ключі', () => {
    const raw = [
      'diff --git a/.env.local b/.env.local',
      '--- a/.env.local',
      '+++ b/.env.local',
      '+OPENROUTER_API_KEY=sk-secret-value',
      'diff --git a/src/a.ts b/src/a.ts',
      '+const API_KEY = "my-secret";',
      '+const header = "Bearer abc.def.ghi";',
    ].join('\n');
    const clean = sanitizeDiff(raw);
    expect(clean).not.toContain('.env.local');
    expect(clean).not.toContain('sk-secret-value');
    expect(clean).not.toContain('my-secret');
    expect(clean).toContain('[REDACTED]');
  });

  it('перепитує 1 раз при невалідному JSON і повертає валідний вердикт', async () => {
    let calls = 0;
    const res = await evaluateSingleCriterion(C1, 'diff --git a/a.ts b/a.ts', async () => {
      calls++;
      if (calls === 1) return 'не JSON';
      return JSON.stringify({
        id: 'A1',
        verdict: 'pass',
        reason: 'Знайдено тест',
        evidence: 'tests/a.test.ts:1',
      });
    });
    expect(calls).toBe(2);
    expect(res.verdict).toBe('pass');
  });

  it('падає з помилкою після 2 невалідних спроб', async () => {
    await expect(
      evaluateSingleCriterion(C1, 'diff --git a/a.ts b/a.ts', async () => 'still not json'),
    ).rejects.toThrow(/після 2 спроб/);
  });
});