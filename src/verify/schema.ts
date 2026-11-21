import { z } from 'zod';

/** Один критерій приймання зі spec.md — один запис вердикту. */
export const criterionVerdict = z
  .object({
    /** Номер критерію з docs/lab2/spec.md, дослівно. */
    id: z.string().min(1),
    /** unknown — аварійний вихід: даних у наданій зміні недостатньо для судження. */
    verdict: z.enum(['pass', 'fail', 'unknown']),
    /** Чому саме так. Одне-два речення, без загальних порад. */
    reason: z.string().min(1),
    /** Файл і рядок або цитата зі зміни; порожньо лише для unknown. */
    evidence: z.string(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.verdict === 'unknown') {
      if (val.evidence.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Для verdict="unknown" поле evidence має бути порожнім рядком',
          path: ['evidence'],
        });
      }
    } else if (val.evidence.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Для verdict="pass" або "fail" потрібне непорожнє evidence',
        path: ['evidence'],
      });
    }
  });

export const verifyReport = z
  .object({ results: z.array(criterionVerdict).min(1) })
  .strict()
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const r of val.results) {
      if (seen.has(r.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Дублікат критерію id="${r.id}" у verifyReport`,
          path: ['results'],
        });
      }
      seen.add(r.id);
    }
  });

export type CriterionVerdict = z.infer<typeof criterionVerdict>;
export type VerifyReport = z.infer<typeof verifyReport>;

/** Брама: червоно, щойно є хоч один fail. unknown браму не валить, але потрапляє у звіт. */
export function isBlocked(report: VerifyReport): boolean {
  return report.results.some((r) => r.verdict !== 'pass');
}