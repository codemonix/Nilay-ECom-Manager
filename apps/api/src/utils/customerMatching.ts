/** Shared by Packing (grouping a customer's orders) and Order Precheck (finding a customer's other orders) so both decide "same customer" identically. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Digits only, Persian/Arabic digits converted, and Iranian country-code prefixes (+98 / 0098 / 98) folded into the leading-0 form, so "+98 912 111 2233" and "09121112233" group together. */
export function normalizeMobile(raw: string | null): string | null {
  if (!raw) return null;
  let digits = raw
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length > 10) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  return digits || null;
}

export function normalizeName(raw: string | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Same customer = same mobile number; orders with no mobile fall back to matching by name; anything else stands alone. */
export function customerGroupKey(order: { buyerMobile: string | null; buyerName: string | null; orderNumber: string }): string {
  const mobile = normalizeMobile(order.buyerMobile);
  if (mobile) return `m:${mobile}`;
  const name = normalizeName(order.buyerName);
  if (name) return `n:${name}`;
  return `o:${order.orderNumber}`;
}
