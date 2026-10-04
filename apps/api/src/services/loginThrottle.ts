/**
 * In-memory brute-force guard for POST /auth/login. Two independent
 * windows: failures for one email from one IP (a guessed password), and
 * failures from one IP across any emails (credential stuffing). Either one
 * reaching its limit blocks further attempts from that IP until the window
 * slides past. State is per process, which fits the single API container
 * this app runs as; a restart clears it.
 */
const WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_LIMITS = {
  perAccount: 5,
  perIp: 20,
} as const;

const failures = new Map<string, number[]>();

function prune(key: string, now: number): number[] {
  const recent = (failures.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length) failures.set(key, recent);
  else failures.delete(key);
  return recent;
}

function keys(ip: string, email: string): { account: string; ip: string } {
  return { account: `acct:${ip}:${email.trim().toLowerCase()}`, ip: `ip:${ip}` };
}

/** Seconds until the caller may try again, or 0 when not blocked. */
export function retryAfterSeconds(ip: string, email: string, now = Date.now()): number {
  const k = keys(ip, email);
  const blockedUntil = [
    [prune(k.account, now), LOGIN_THROTTLE_LIMITS.perAccount] as const,
    [prune(k.ip, now), LOGIN_THROTTLE_LIMITS.perIp] as const,
  ]
    .filter(([attempts, limit]) => attempts.length >= limit)
    .map(([attempts, limit]) => attempts[attempts.length - limit]! + WINDOW_MS);
  if (blockedUntil.length === 0) return 0;
  return Math.ceil((Math.max(...blockedUntil) - now) / 1000);
}

/** Above this many tracked keys, a failure sweeps out expired ones, so a run over many emails can't grow the map without bound. */
const SWEEP_THRESHOLD = 10_000;

export function recordFailure(ip: string, email: string, now = Date.now()): void {
  if (failures.size > SWEEP_THRESHOLD) for (const key of [...failures.keys()]) prune(key, now);
  const k = keys(ip, email);
  for (const key of [k.account, k.ip]) failures.set(key, [...prune(key, now), now]);
}

/** A successful login clears that account's counter (not the IP's, so a stuffing run can't reset itself by hitting one valid login). */
export function recordSuccess(ip: string, email: string): void {
  failures.delete(keys(ip, email).account);
}

/** Test hook. */
export function resetLoginThrottle(): void {
  failures.clear();
}
