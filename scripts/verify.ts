import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  criterionVerdict,
  isBlocked,
  type CriterionVerdict,
  type VerifyReport,
} from '../src/verify/schema';

export interface SpecCriterion {
  readonly id: string;
  readonly statement: string;
  readonly checker: string;
}

class FatalJudgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalJudgeError';
  }
}

/** Витягує критерії приймання (A1..AN) з docs/lab2/spec.md. */
export function parseSpecCriteria(specText: string): SpecCriterion[] {
  const lines = specText.replace(/^\uFEFF/, '').split(/\r?\n/);
  const items: SpecCriterion[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cols = trimmed
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    if (cols.length < 3) continue;
    const id = (cols[0] ?? '').replace(/^\*\*|\*\*$/g, '').trim();
    if (!/^A\d+$/.test(id)) continue;
    items.push({
      id,
      statement: cols[1] ?? '',
      checker: cols[2] ?? '',
    });
  }
  return items;
}

/** Видаляє .env* із diff і маскує секрети перед відправкою в модель верифікатора. */
export function sanitizeDiff(raw: string): string {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const filtered: string[] = [];
  let skippingEnvFile = false;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      skippingEnvFile = /(?:^|\s|a\/|b\/)\.env(?:\.|$)/i.test(line);
      if (skippingEnvFile) continue;
    }
    if (skippingEnvFile) continue;
    if (/^(?:---|\+\+\+)\s+[ab]\/\.env(?:\.|$)/i.test(line)) continue;

    const redacted = line
      .replace(
        /(^|[^A-Za-z0-9_])([A-Za-z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD))\s*[:=]\s*["']?[^\s"']+/gi,
        '$1$2=[REDACTED]',
      )
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
    filtered.push(redacted);
  }

  return filtered.join('\n');
}

function cleanEnv(v: string | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '');
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Відповідь моделі не містить JSON-обʼєкта');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export type JudgeFn = (system: string, user: string) => Promise<string>;

/** Перевіряє один критерій; при невалідній відповіді перепитує 1 раз і падає з помилкою. */
export async function evaluateSingleCriterion(
  criterion: SpecCriterion,
  changeText: string,
  judge: JudgeFn,
): Promise<CriterionVerdict> {
  const system = [
    'Ти — незалежний верифікатор змін (інша модель, ніж автор коду).',
    'Оціни РІВНО ОДИН критерій приймання за наданою зміною.',
    'Поверни СТРОГО валідний JSON без зайвого тексту за схемою:',
    '{"id":"<id>","verdict":"pass|fail|unknown","reason":"<1-2 речення>","evidence":"<файл/рядок або порожньо для unknown>"}',
    'Правила:',
    '- pass: у зміні присутні всі вимагані критерієм файли/артефакти з конкретним вмістом (наприклад, для A4 — файл docs/lab2/verifier.md із записом про зупинене злиття та нетривіальні тести у tests/verify.test.ts із expect); evidence вказує файл/рядок або цитату.',
    '- fail: у зміні є прямий доказ порушення критерію або зміна реалізує відповідний модуль, але пропускає обовʼязковий артефакт цього критерію (наприклад, відсутній docs/lab2/verifier.md при додаванні верифікатора); evidence вказує файл/рядок або цитату.',
    '- unknown: зміна стосується інших частин проєкту і не містить даних (наприклад, результатів запуску CLI чи git log попередніх кроків) для підтвердження або спростування критерію; evidence має бути порожнім рядком "".',
    '- Заборонено вигадувати докази або давати загальні поради.',
  ].join('\n');

  const user = [
    `Критерій ${criterion.id}: ${criterion.statement}`,
    `Як перевіряється: ${criterion.checker}`,
    '--- ЗМІНА ---',
    changeText.slice(0, 12_000),
  ].join('\n');

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawResponse = await judge(
        attempt === 1
          ? system
          : `${system}\nПопередня відповідь не пройшла схему Zod. Поверни ЛИШЕ чистий JSON-обʼєєкт.`,
        user,
      );
      const parsedJson = extractJsonObject(rawResponse);
      const parsed = criterionVerdict.safeParse(parsedJson);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
      }
      if (parsed.data.id !== criterion.id) {
        throw new Error(`Очікувався id=${criterion.id}, отримано ${parsed.data.id}`);
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof FatalJudgeError) {
        throw err;
      }
      lastError = err;
    }
  }

  throw new Error(
    `Верифікатор не повернув валідний вердикт для ${criterion.id} після 2 спроб: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createOpenRouterJudge(modelId: string, apiKey: string): JudgeFn {
  return async (system, user) => {
    for (let tryNum = 1; tryNum <= 3; tryNum++) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0,
          max_tokens: 4096,
          reasoning: { effort: 'low' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.status === 429 && tryNum < 3) {
        await sleep(4500 * tryNum);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        const safeBody = body.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 240);
        const msg = `OpenRouter HTTP ${res.status}: ${safeBody}`;
        if (res.status === 401 || res.status === 402 || res.status === 404) {
          throw new FatalJudgeError(msg);
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        choices?: readonly { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? '';
    }
    throw new Error('OpenRouter вичерпав спроби через HTTP 429');
  };
}

export async function runVerify(
  specPath: string,
  diffPath: string,
  judge: JudgeFn,
): Promise<VerifyReport> {
  const specText = readFileSync(specPath, 'utf8');
  const criteria = parseSpecCriteria(specText);
  if (criteria.length === 0) {
    throw new Error(`Не знайдено критеріїв A1..AN у ${specPath}`);
  }
  const rawDiff = readFileSync(diffPath, 'utf8');
  const safeDiff = sanitizeDiff(rawDiff).trim();
  if (!safeDiff) {
    throw new Error(`Файл ${diffPath} порожній після санітизації`);
  }
  const results: CriterionVerdict[] = [];
  for (const c of criteria) {
    results.push(await evaluateSingleCriterion(c, safeDiff, judge));
    await sleep(1200);
  }
  return { results };
}

if (process.argv[1] && /(?:^|[\\/])verify\.(?:ts|js)$/.test(process.argv[1])) {
  (async () => {
    const diffPath = process.argv[2] ?? 'docs/lab2/verify-input.diff';
    const specPath = process.argv[3] ?? 'docs/lab2/spec.md';
    const outJsonPath = process.argv[4];
    const apiKey = cleanEnv(process.env.OPENROUTER_API_KEY);
    const modelId =
      cleanEnv(process.env.VERIFIER_MODEL) ||
      cleanEnv(process.env.OPENROUTER_MODEL) ||
      'deepseek/deepseek-v4.1-flash';
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY порожній у .env.local (потрібен інший провайдер для верифікатора)');
    }
    const judge = createOpenRouterJudge(modelId, apiKey);
    const report = await runVerify(specPath, diffPath, judge);
    for (const r of report.results) {
      console.log(`${r.id} | ${r.verdict} | ${r.reason} | evidence=${r.evidence}`);
    }
    if (outJsonPath) {
      mkdirSync(dirname(outJsonPath), { recursive: true });
      writeFileSync(outJsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    }
    if (isBlocked(report)) {
      console.error('БРАМА ВЕРИФІКАТОРА: знайдено fail — злиття заблоковано.');
      process.exit(1);
    }
  })().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}