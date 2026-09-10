import type { SupportedLanguage } from "../i18n/i18n";

/**
 * Locale-aware formatting utilities. Dates are stored in UTC in MongoDB and
 * converted to the viewer's local timezone here at render time.
 *
 * IMPORTANT: never pass identifiers (case numbers, SKUs, order numbers,
 * phone numbers, emails) through formatNumber/formatDate -- those must be
 * rendered exactly as stored so they stay usable/searchable regardless of
 * the active language. These helpers are only for genuinely numeric or
 * date values meant to be read as quantities/dates.
 */

function toLocale(language: SupportedLanguage): string {
  return language === "fa" ? "fa-IR" : "en-US";
}

export function formatDate(value: string | number | Date, language: SupportedLanguage): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(toLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | number | Date, language: SupportedLanguage): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(toLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | number | Date, language: SupportedLanguage): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(toLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelativeTime(value: string | number | Date, language: SupportedLanguage): string {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(toLocale(language), { numeric: "auto" });

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

export function formatNumber(value: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(toLocale(language)).format(value);
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Renders a byte count as a human-readable size (e.g. "12.4 MB"), with locale-aware digits. */
export function formatBytes(bytes: number, language: SupportedLanguage): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return `${formatNumber(0, language)} ${BYTE_UNITS[0]}`;
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const formatted = new Intl.NumberFormat(toLocale(language), {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(value);
  return `${formatted} ${BYTE_UNITS[exponent]}`;
}

export function formatCurrency(
  value: number,
  language: SupportedLanguage,
  currency = "IRR",
): string {
  return new Intl.NumberFormat(toLocale(language), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
