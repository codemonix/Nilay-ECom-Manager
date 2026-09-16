/**
 * Marks an order's admin note ("یادداشت مدیر") with the set of item
 * product codes Order Precheck found unavailable, so a later reopen of the
 * same order (once its status is back to "پردازش انبار") can restore each
 * item's available/unavailable choice instead of asking staff to redo it
 * from scratch. Deliberately a distinct, greppable marker rather than the
 * row-number convention used by shopfaOrderNoteParser.ts (Reporting's
 * shortage report) -- the two features read/write the same free-text field
 * for different purposes, and a plain product-code array is far less
 * ambiguous to parse back out than a row-number reference.
 *
 * The codes are written as a bare comma-separated list, deliberately WITHOUT
 * quotes or JSON syntax -- confirmed live (2026-09-16, test order session
 * 4783608554) that Shopfa HTML-entity-encodes an order note on write: a
 * marker built with `JSON.stringify(codes)` (which wraps each code in `"`)
 * came back from a later read as `[&quot;7724765&quot;]`, which is not
 * valid JSON, so `JSON.parse` threw and the marker silently failed to
 * restore anything. Product codes are plain numeric strings, so a
 * quote-free, comma-separated list round-trips safely through this
 * encoding. parseOrderPrecheckUnavailableCodes additionally decodes common
 * HTML entities defensively before matching, in case a future marker or a
 * hand-edited note re-introduces a character Shopfa encodes.
 */
const MARKER_LABEL = "پیش‌بررسی سفارش - کدهای ناموجود";
const MARKER_PATTERN = new RegExp(`\\[${MARKER_LABEL}:\\s*([^\\]]*)\\]`);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/**
 * Rebuilds the note to write back: the marker (omitted entirely when every
 * item turned out to be available) followed by whatever free text the note
 * already carried outside of a previous marker occurrence, so unrelated
 * staff-written text in the note survives repeated precheck saves. Matches
 * against the raw (possibly HTML-entity-encoded) existing note, since the
 * marker's own bracket/label characters are never entity-encoded -- only
 * quote characters have been observed to be.
 */
export function buildOrderPrecheckNote(existingNote: string, unavailableProductCodes: string[]): string {
  const rest = existingNote.replace(MARKER_PATTERN, "").trim();
  if (unavailableProductCodes.length === 0) return rest;
  const marker = `[${MARKER_LABEL}: ${unavailableProductCodes.join(", ")}]`;
  return rest ? `${marker}\n${rest}` : marker;
}

/**
 * Extracts the product codes Order Precheck previously marked unavailable
 * on this order, or null when the note carries no such marker at all (a
 * fresh order, or one in "پردازش انبار" for an unrelated reason) -- callers
 * should treat null ("nothing to restore") differently from an empty array
 * (every item was available, though buildOrderPrecheckNote never actually
 * writes the marker in that case -- an empty marker is only reachable via a
 * hand-edited note).
 */
export function parseOrderPrecheckUnavailableCodes(note: string): string[] | null {
  const match = MARKER_PATTERN.exec(decodeHtmlEntities(note));
  if (!match) return null;
  const inner = (match[1] ?? "").trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}
