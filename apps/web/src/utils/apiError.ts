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
