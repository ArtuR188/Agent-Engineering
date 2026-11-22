import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const BREAKER_FILE = '.harness/breaker.json';

export const breakerConfig = {
  consecutiveFailThreshold: 3,
  noProgressLimit: 3,
  maxTaskUsd: 0.25,
  redGateRatioThreshold: 0.6,
  redGateWindow: 5,
  baseCooldownMin: 15,
  maxCooldownMin: 120,
} as const;

export const breakerStateSchema = z.object({
  state: z.enum(['closed', 'open', 'half-open']),
  fails: z.number().int().min(0),
  noProgress: z.number().int().min(0),
  recentResults: z.array(z.boolean()),
  openedAt: z.string().nullable(),
  cooldownMin: z.number().positive(),
  trip: z.string().nullable(),
  probeInFlight: z.boolean(),
});

export type BreakerState = z.infer<typeof breakerStateSchema>;

export interface RecordInput {
  readonly ok: boolean;
  readonly tripReason?: string | null;
  readonly quota429?: boolean;
  readonly costUsd?: number;
  readonly madeProgress?: boolean;
}

const DEFAULT_STATE: BreakerState = {
  state: 'closed',
  fails: 0,
  noProgress: 0,
  recentResults: [],
  openedAt: null,
  cooldownMin: breakerConfig.baseCooldownMin,
  trip: null,
  probeInFlight: false,
};

export function loadBreaker(filePath = BREAKER_FILE): BreakerState {
  if (!existsSync(filePath)) return { ...DEFAULT_STATE, recentResults: [] };
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return breakerStateSchema.parse(raw);
}

export function saveBreaker(state: BreakerState, filePath = BREAKER_FILE): void {
  const valid = breakerStateSchema.parse(state);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(valid, null, 2)}\n`, 'utf8');
}

export function mayRun(
  filePath = BREAKER_FILE,
  nowMs = Date.now(),
): { allow: boolean; probe: boolean; why: string } {
  const b = loadBreaker(filePath);

  if (b.state === 'closed') {
    return { allow: true, probe: false, why: 'closed' };
  }

  if (b.state === 'half-open') {
    if (b.probeInFlight) {
      return { allow: false, probe: false, why: 'half-open: пробна задача вже виконується' };
    }
    saveBreaker({ ...b, probeInFlight: true }, filePath);
    return { allow: true, probe: true, why: 'half-open: рівно одна пробна задача' };
  }

  const openedMs = b.openedAt ? Date.parse(b.openedAt) : nowMs;
  const waitedMin = (nowMs - openedMs) / 60_000;
  if (waitedMin < b.cooldownMin) {
    const left = Math.ceil(b.cooldownMin - waitedMin);
    return {
      allow: false,
      probe: false,
      why: `open (${b.trip ?? 'unknown'}): залишилось ~${left} хв перепочинку`,
    };
  }

  saveBreaker({ ...b, state: 'half-open', probeInFlight: true }, filePath);
  return { allow: true, probe: true, why: 'half-open: перепочинок завершено, старт пробної задачі' };
}

export function recordBreaker(
  input: RecordInput,
  filePath = BREAKER_FILE,
  nowMs = Date.now(),
): BreakerState {
  const b = loadBreaker(filePath);
  const recentResults = [...b.recentResults, input.ok].slice(-breakerConfig.redGateWindow);

  if (input.ok && !input.quota429 && (input.costUsd ?? 0) <= breakerConfig.maxTaskUsd) {
    const next: BreakerState = {
      state: 'closed',
      fails: 0,
      noProgress: input.madeProgress === false ? b.noProgress + 1 : 0,
      recentResults,
      openedAt: null,
      cooldownMin: breakerConfig.baseCooldownMin,
      trip: null,
      probeInFlight: false,
    };
    if (next.noProgress >= breakerConfig.noProgressLimit) {
      const stalled: BreakerState = {
        ...next,
        state: 'open',
        openedAt: new Date(nowMs).toISOString(),
        trip: `no_progress_${breakerConfig.noProgressLimit}_tasks`,
      };
      saveBreaker(stalled, filePath);
      return stalled;
    }
    saveBreaker(next, filePath);
    return next;
  }

  const fails = b.fails + 1;
  const noProgress = b.noProgress + 1;
  const redCount = recentResults.filter((r) => !r).length;
  const redRatio = recentResults.length >= breakerConfig.redGateWindow
    ? redCount / recentResults.length
    : 0;

  let trip: string | null = null;
  if (input.quota429) {
    trip = 'provider_quota_429';
  } else if ((input.costUsd ?? 0) > breakerConfig.maxTaskUsd) {
    trip = `budget_exceeded_${input.costUsd?.toFixed(4)}_gt_${breakerConfig.maxTaskUsd}`;
  } else if (b.state === 'half-open') {
    trip = `half_open_probe_failed:${input.tripReason ?? 'error'}`;
  } else if (fails >= breakerConfig.consecutiveFailThreshold) {
    trip = `consecutive_failures_${fails}:${input.tripReason ?? 'error'}`;
  } else if (noProgress >= breakerConfig.noProgressLimit) {
    trip = `no_progress_${noProgress}_tasks`;
  } else if (redRatio > breakerConfig.redGateRatioThreshold) {
    trip = `red_gate_ratio_${redRatio.toFixed(2)}`;
  }

  const shouldOpen = trip !== null;
  const nextCooldown = b.state === 'half-open'
    ? Math.min(b.cooldownMin * 2, breakerConfig.maxCooldownMin)
    : b.cooldownMin;

  const next: BreakerState = {
    state: shouldOpen ? 'open' : 'closed',
    fails,
    noProgress,
    recentResults,
    openedAt: shouldOpen ? new Date(nowMs).toISOString() : null,
    cooldownMin: nextCooldown,
    trip,
    probeInFlight: false,
  };

  saveBreaker(next, filePath);
  return next;
}