import { getNextSequence } from "../models/Counter";

function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Generates human-friendly, per-day-sequential case numbers, e.g. C-20260903-0001. */
export async function generateCaseNumber(now: Date = new Date()): Promise<string> {
  const key = dateKey(now);
  const seq = await getNextSequence(`case-${key}`);
  return `C-${key}-${String(seq).padStart(4, "0")}`;
}
