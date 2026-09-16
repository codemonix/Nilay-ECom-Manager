/**
 * Parses row-number references out of an order's admin note ("یادداشت
 * مدیر"), e.g. "کمبود موارد 2 و 3 و 4" (shortage in items 2, 3, and 4) or
 * "مورد دو" (item two, spelled out). Backs Reporting's shortage report --
 * see shopfa-api-testing-fixtures memory for how the row-numbering
 * convention itself (which item is "row N") was confirmed.
 */

const ITEM_KEYWORD_PATTERN = /مورد|موارد/;

const PERSIAN_NUMBER_WORDS: Record<string, number> = {
  یک: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function persianDigitsToLatin(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

function parseNumberToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed in PERSIAN_NUMBER_WORDS) return PERSIAN_NUMBER_WORDS[trimmed]!;
  const parsed = Number.parseInt(persianDigitsToLatin(trimmed), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** True when the note references specific item rows at all -- an order whose note lacks this counts its whole item list as short (see ShortageReportResultDTO). */
export function noteReferencesItems(note: string): boolean {
  return ITEM_KEYWORD_PATTERN.test(note);
}

const NUMBER_TOKEN = "(?:[0-9۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)";
const CONNECTOR = "\\s*(?:و|,|،)\\s*";
const REFERENCE_RUN_PATTERN = new RegExp(`(?:موارد|مورد)\\s*(${NUMBER_TOKEN}(?:${CONNECTOR}${NUMBER_TOKEN})*)`, "g");

/**
 * Extracts every 1-based row number referenced after "مورد"/"موارد" in the
 * note, stopping each run at the first token that isn't a number or an
 * "and" connector -- so trailing text like "2 عدد" (a quantity, not
 * another row reference) after a spelled-out number ("مورد دو 2 عدد")
 * isn't misread as row 2. Returns an empty array if noteReferencesItems
 * would also be false, or if the keyword was present but nothing after it
 * parsed as a number.
 */
export function parseNoteItemRowNumbers(note: string): number[] {
  const rowNumbers = new Set<number>();
  for (const match of note.matchAll(REFERENCE_RUN_PATTERN)) {
    const run = match[1] ?? "";
    for (const token of run.split(new RegExp(CONNECTOR))) {
      const n = parseNumberToken(token);
      if (n !== null) rowNumbers.add(n);
    }
  }
  return Array.from(rowNumbers).sort((a, b) => a - b);
}

/**
 * Orders items the way the Shopfa admin dashboard displays them for
 * note row-number references: plain alphabetical (Unicode code-unit)
 * order by title, NOT the order the API's `items` array returns them in.
 * Confirmed live against two real orders -- see the shopfa-api-testing-
 * fixtures memory for the corroborating evidence (a "2 پیس short" note
 * landing exactly on the one item with count 2, only under this
 * ordering).
 */
export function sortItemsForNoteRowNumbering<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}
