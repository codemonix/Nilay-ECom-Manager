export interface DateRangeValue {
  from: string;
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-calendar YYYY-MM-DD, the value format of `<input type="date">` and of the report APIs' `from`/`to`. */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The window ending today and starting `days - 1` days earlier (so "7 days" is today plus the previous six). */
export function lastDaysRange(days: number): DateRangeValue {
  const today = new Date();
  return { from: toDateInputValue(new Date(today.getTime() - (days - 1) * DAY_MS)), to: toDateInputValue(today) };
}

export function isValidDateRange({ from, to }: DateRangeValue): boolean {
  return Boolean(from) && Boolean(to) && from <= to && Date.parse(to) - Date.parse(from) <= 366 * DAY_MS;
}

