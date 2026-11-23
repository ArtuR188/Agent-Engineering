import { relative, resolve } from 'node:path';

const FORBIDDEN_WRITE_PREFIXES = ['.harness/', '.github/', '.git/', 'tests/'];
const BYPASS_RE = /dangerously-skip-permissions|bypassPermissions/i;
const SECRET_OR_CANARY_RE =
  /канарка-NOT-A-SECRET-[A-Za-z0-9_-]+|CANARY_NOT_A_SECRET|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|pk-lf-[0-9A-Za-z_-]{10,}|sk-lf-[0-9A-Za-z_-]{10,}|ghp_[0-9A-Za-z]{20,}/;

function normRel(root: string, rel: string): string {
  const abs = resolve(root, rel);
  return relative(root, abs).replace(/\\/g, '/');
}

/**
 * Жорстка межа читання: забороняє вихід за межі worktree та будь-які .env файли.
 */
export function assertReadAllowed(root: string, rel: string): string {
  const abs = resolve(root, rel);
  const d = normRel(root, rel);
  if (d.startsWith('..') || /(^|\/)\.env(\.|$)/i.test(d)) {
    throw new Error(`Заборонений шлях читання (policy): ${rel}`);
  }
  return abs;
}

/**
 * Жорстка межа запису: блокує вихід за worktree, .env, системні теки (.harness, .github, tests),
 * файли поза білим списком задачі та прапорці обходу дозволів у вмісті.
 */
export function assertWriteAllowed(
  root: string,
  rel: string,
  content: string,
  allowedFiles?: readonly string[],
): string {
  const abs = assertReadAllowed(root, rel);
  const d = normRel(root, rel);

  if (FORBIDDEN_WRITE_PREFIXES.some((p) => d.startsWith(p))) {
    throw new Error(`Заборонена тека запису (policy): ${rel}`);
  }
  if (allowedFiles && allowedFiles.length > 0) {
    const allowed = new Set(allowedFiles.map((f) => f.replace(/\\/g, '/').replace(/^\.\//, '')));
    if (!allowed.has(d)) {
      throw new Error(`Файл поза білим списком задачі (policy): ${rel}`);
    }
  }
  if (BYPASS_RE.test(content)) {
    throw new Error(`Виявлено заборонений обхід дозволів у вмісті (policy): ${rel}`);
  }
  return abs;
}

/**
 * Вихідна межа (egress guard): блокує витік канарки або секретів у відповіді/артефакті.
 */
export function assertSafeOutput(text: string): string {
  if (SECRET_OR_CANARY_RE.test(text)) {
    throw new Error('Виявлено витік канарки або секрету у виводі (egress policy)');
  }
  return text;
}
