import { counterRepository } from "../repositories/counterRepository";

function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Generates human-friendly, per-day-sequential package numbers, e.g. PKG-20260911-0001. */
export async function generatePackageNumber(now: Date = new Date()): Promise<string> {
  const key = dateKey(now);
  const seq = await counterRepository.getNextSequence(`package-${key}`);
  return `PKG-${key}-${String(seq).padStart(4, "0")}`;
}
