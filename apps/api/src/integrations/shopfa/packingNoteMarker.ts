/**
 * Marks an order's admin note ("یادداشت مدیر") with how many confirmation
 * photos Packing took of its box. Shopfa's API has no way to attach images
 * to an order, so the photos themselves stay local (PackingRecord
 * attachments) and only their count is pushed. Same conventions as
 * orderPrecheckNoteMarker.ts: a distinct bracketed marker with no quote
 * characters (Shopfa HTML-entity-encodes notes on write), placed first and
 * replacing any earlier packing marker so a retried or repeated push never
 * stacks duplicates, while the rest of the note is kept as-is.
 */
const MARKER_LABEL = "بسته‌بندی - تعداد عکس";
const MARKER_PATTERN = new RegExp(`\\[${MARKER_LABEL}:\\s*(\\d+)\\]\\n?`);

export function buildPackingPhotoNote(existingNote: string, photoCount: number): string {
  const rest = existingNote.replace(MARKER_PATTERN, "").trim();
  const marker = `[${MARKER_LABEL}: ${photoCount}]`;
  return rest ? `${marker}\n${rest}` : marker;
}

/** The photo count a previous packing push wrote into the note, or null when there's none. */
export function parsePackingPhotoCount(note: string): number | null {
  const match = MARKER_PATTERN.exec(note);
  return match ? Number(match[1]) : null;
}
