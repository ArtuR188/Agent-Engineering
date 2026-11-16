import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createOpenRouterJudge, evaluateSingleCriterion, type SpecCriterion } from './verify';
import type { CriterionVerdict } from '../src/verify/schema';

interface CalibrationCase {
  readonly index: number;
  readonly label: string;
  readonly diffText: string;
  readonly criterion: SpecCriterion;
  readonly manualVerdict: 'pass' | 'fail' | 'unknown';
}

const A1: SpecCriterion = {
  id: 'A1',
  statement: '`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` проходять без помилок',
  checker: 'Прогін локально та в CI',
};

const A2: SpecCriterion = {
  id: 'A2',
  statement: '`docs/lab2/golden/queries.jsonl` містить ≥ 20 запитів і проходить валідатор',
  checker: '`npx tsx scripts/validate-golden.ts`',
};

const A3: SpecCriterion = {
  id: 'A3',
  statement: '`docs/lab2/spec.md` закомічено до першого коміту коду Лаб. 2, а в `.agent-log/*.jsonl` немає записів редагування `spec.md`',
  checker: '`git log` та `Select-String -Path .agent-log\\*.jsonl -Pattern \'lab2/spec\\.md\'`',
};

const A4: SpecCriterion = {
  id: 'A4',
  statement: 'Верифікатор на іншій моделі щонайменше 1 раз зупинив злиття через знайдену помилку',
  checker: 'Запис у `docs/lab2/verifier.md` та тести верифікатора',
};

const CASES: readonly CalibrationCase[] = [
  {
    index: 1,
    label: 'Коміт 9415544: додано docs/lab2/spec.md (лише спека)',
    diffText: 'diff --git a/docs/lab2/spec.md b/docs/lab2/spec.md\nnew file mode 100644\n+## 6. Критерії приймання\n+| A1 | npm test проходить | прогін CI |',
    criterion: A1,
    manualVerdict: 'unknown',
  },
  {
    index: 2,
    label: 'Коміт 9bced4d: додано validate-golden.ts з порогом 20 і 20 запитів у queries.jsonl',
    diffText: 'diff --git a/scripts/validate-golden.ts b/scripts/validate-golden.ts\n+export const SUBMIT: Thresholds = { total: 20, unanswerable: 3, injection: 2 };\ndiff --git a/docs/lab2/golden/queries.jsonl b/docs/lab2/golden/queries.jsonl\n+{"id":"q-01",...}\n+{"id":"q-20",...}',
    criterion: A2,
    manualVerdict: 'pass',
  },
  {
    index: 3,
    label: 'Неповний diff 9bced4d: змінено лише tests/validate-golden.test.ts без queries.jsonl',
    diffText: 'diff --git a/tests/validate-golden.test.ts b/tests/validate-golden.test.ts\n+it("приймає коректний рядок", () => { expect(true).toBe(true); });',
    criterion: A2,
    manualVerdict: 'unknown',
  },
  {
    index: 4,
    label: 'Дефектний diff: у queries.jsonl лише 5 запитів замість ≥ 20',
    diffText: 'diff --git a/docs/lab2/golden/queries.jsonl b/docs/lab2/golden/queries.jsonl\n+{"id":"q-01"}\n+{"id":"q-02"}\n+{"id":"q-03"}\n+{"id":"q-04"}\n+{"id":"q-05"}',
    criterion: A2,
    manualVerdict: 'fail',
  },
  {
    index: 5,
    label: 'Коміт 61ac0ef: додано baseline.md без згадки git log або .agent-log',
    diffText: 'diff --git a/docs/lab2/baseline.md b/docs/lab2/baseline.md\n+# Базова лінія без пошуку\n+| Точність | 0% (0/20) |',
    criterion: A3,
    manualVerdict: 'unknown',
  },
  {
    index: 6,
    label: 'Лог перевірки A3: git log показує 9415544 до 9bced4d, пошук у .agent-log/*.jsonl дав 0 збігів',
    diffText: 'diff --git a/docs/lab2/audit-a3.txt b/docs/lab2/audit-a3.txt\n+git log --oneline: 9415544 docs(lab2): add v1 specification -> 9bced4d feat(lab2): freeze golden query set\n+Select-String .agent-log/*.jsonl lab2/spec.md: 0 matches',
    criterion: A3,
    manualVerdict: 'pass',
  },
  {
    index: 7,
    label: 'Дефектний лог A3: у .agent-log/opencode.jsonl є tool=edit для docs/lab2/spec.md',
    diffText: 'diff --git a/.agent-log/opencode.jsonl b/.agent-log/opencode.jsonl\n+{"tool":"edit","path":"docs/lab2/spec.md","ok":true}',
    criterion: A3,
    manualVerdict: 'fail',
  },
  {
    index: 8,
    label: 'Крок 03 без verifier.md: є scripts/verify.ts і verify-gate.yml, але docs/lab2/verifier.md відсутній',
    diffText: 'diff --git a/scripts/verify.ts b/scripts/verify.ts\n+export async function runVerify(...) {}\ndiff --git a/.github/workflows/verify-gate.yml b/.github/workflows/verify-gate.yml\n+run: npm run verify',
    criterion: A4,
    manualVerdict: 'fail',
  },
  {
    index: 9,
    label: 'Крок 03 з docs/lab2/verifier.md (зафіксовано стоп злиття) і tests/verify.test.ts',
    diffText: 'diff --git a/docs/lab2/verifier.md b/docs/lab2/verifier.md\n+## Верифікатор зупинив зміну\n+- Коміт зупинено: A4 fail, process.exit(1)\ndiff --git a/tests/verify.test.ts b/tests/verify.test.ts\n+describe("scripts/verify", () => {})',
    criterion: A4,
    manualVerdict: 'pass',
  },
  {
    index: 10,
    label: 'Дефектний CI workflow: з verify-gate.yml видалено npm test і npm run build',
    diffText: 'diff --git a/.github/workflows/verify-gate.yml b/.github/workflows/verify-gate.yml\n-      - run: npm test\n-      - run: npm run build',
    criterion: A1,
    manualVerdict: 'fail',
  },
];

function cleanEnv(v: string | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const apiKey = cleanEnv(process.env.OPENROUTER_API_KEY);
  const modelId = cleanEnv(process.env.VERIFIER_MODEL) || 'deepseek/deepseek-v4.1-flash';
  if (!apiKey) throw new Error('OPENROUTER_API_KEY відсутній');

  const judge = createOpenRouterJudge(modelId, apiKey);

  const results: {
    readonly index: number;
    readonly label: string;
    readonly criterionId: string;
    readonly manualVerdict: string;
    readonly judgeVerdict: CriterionVerdict;
    readonly match: boolean;
  }[] = [];

  for (const c of CASES) {
    let v: CriterionVerdict;
    try {
      v = await evaluateSingleCriterion(c.criterion, c.diffText, judge);
    } catch (e) {
      if (e instanceof Error && e.name === 'FatalJudgeError') {
        throw e;
      }
      throw e;
    }
    const match = v.verdict === c.manualVerdict;
    results.push({
      index: c.index,
      label: c.label,
      criterionId: c.criterion.id,
      manualVerdict: c.manualVerdict,
      judgeVerdict: v,
      match,
    });
    console.log(
      `#${c.index} [${c.criterion.id}] manual=${c.manualVerdict} | judge=${v.verdict} | match=${match ? 'ТАК' : 'НІ'} | ${v.reason}`,
    );
    await sleep(1200);
  }

  const matched = results.filter((r) => r.match).length;
  const unknowns = results.filter((r) => r.judgeVerdict.verdict === 'unknown').length;
  const outPath = 'docs/lab2/traces/calibration-report.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify({ modelId, total: results.length, matched, unknowns, results }, null, 2) + '\n',
    'utf8',
  );
  console.log(`ПІДСУМОК: ${matched}/${results.length} (${((matched / results.length) * 100).toFixed(0)}%), unknown=${unknowns}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});