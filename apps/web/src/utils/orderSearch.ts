const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Lets staff search with Persian/Arabic keyboard digits and still match a Latin-digit mobile number. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** Search text -> the normalized form matchesOrderSearch expects (trimmed, lower-cased, Latin digits). */
export function normalizeSearchQuery(raw: string): string {
  return normalizeDigits(raw.trim().toLowerCase());
}

/**
 * Matches by customer name, mobile number (any format -- compared as digits
 * only, so "912..." finds "0912...") or order number. `query` must already
 * be normalized with normalizeSearchQuery.
 */
export function matchesOrderSearch(
  order: { orderNumber: string; buyerName: string | null; buyerMobile: string | null },
  query: string,
): boolean {
  if (!query) return true;
  const digits = query.replace(/\D/g, "");
  const name = (order.buyerName ?? "").toLowerCase();
  const mobileDigits = normalizeDigits(order.buyerMobile ?? "").replace(/\D/g, "");
  return (
    name.includes(query) ||
    order.orderNumber.includes(query) ||
    (digits.length > 0 && mobileDigits.includes(digits.replace(/^0+/, "")))
  );
}
