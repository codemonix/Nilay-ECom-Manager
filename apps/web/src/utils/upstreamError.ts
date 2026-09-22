/** Seconds to wait before each successive automatic retry; after the last one, automatic retrying stops and only the manual Retry button remains. */
export const AUTO_RETRY_DELAYS_SECONDS = [10, 20, 30, 60, 60] as const;

export type UpstreamErrorKind = "upstream" | "network";

/**
 * Classifies an RTK Query error as a temporary connectivity problem worth
 * retrying: "upstream" when our API answered 502 UPSTREAM_ERROR (it could not
 * reach Shopfa), "network" when the browser could not reach our API at all.
 * Anything else (validation, auth, bugs) returns null -- retrying won't help.
 */
export function getUpstreamErrorKind(error: unknown): UpstreamErrorKind | null {
  if (!error || typeof error !== "object") return null;
  const { status, data } = error as { status?: unknown; data?: unknown };
  if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") return "network";
  if (status === 502) {
    const code = (data as { error?: { code?: unknown } } | undefined)?.error?.code;
    if (code === "UPSTREAM_ERROR") return "upstream";
  }
  return null;
}

/** Delay in seconds before automatic retry number `attempt` (0-based), or null once the automatic retries are used up. */
export function getAutoRetryDelaySeconds(attempt: number): number | null {
  return AUTO_RETRY_DELAYS_SECONDS[attempt] ?? null;
}
