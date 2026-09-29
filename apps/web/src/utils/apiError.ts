/**
 * RTK Query surfaces a non-2xx JSON response as `{ status, data }` where
 * `data` is our backend's `{ success: false, error: { message } }` body.
 * Pulls that message out when present, so error alerts can show the
 * specific reason (e.g. "missing required columns: ...") instead of a
 * generic message.
 */
export function getApiErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return undefined;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("error" in data)) return undefined;
  const inner = (data as { error?: { message?: unknown } }).error;
  return typeof inner?.message === "string" ? inner.message : undefined;
}

/**
 * The failed request's HTTP status (a number), or RTK Query's string code
 * (e.g. "FETCH_ERROR", "PARSING_ERROR") when no usable response arrived.
 * Useful when the response didn't come from our backend -- a proxy's 413
 * or 504 page has no `error.message` for getApiErrorMessage to find.
 */
export function getApiErrorStatus(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const { status, originalStatus } = error as { status?: unknown; originalStatus?: unknown };
  if (typeof originalStatus === "number") return originalStatus;
  return typeof status === "number" || typeof status === "string" ? status : undefined;
}
