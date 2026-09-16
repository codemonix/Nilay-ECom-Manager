/**
 * Every order status code observed live on the Nilay Jewelry store
 * (confirmed 2026-09-16 by sampling 5,000 recent orders via the Shopfa
 * API), paired with its Persian display title exactly as Shopfa reports
 * it. Shopfa's `/api/shop/orders` `status` filter only accepts the
 * numeric code, not the title, and rejects a comma-separated list -- one
 * call per selected code is required (see
 * ShopfaClient.listOrdersByStatusForShortageReport). This list backs the
 * Shortage Report's status picker so more statuses can be added to future
 * reports without any backend change.
 */
export interface ShopfaOrderStatusOption {
  code: number;
  statusTitle: string;
}

export const SHOPFA_ORDER_STATUS_OPTIONS: ShopfaOrderStatusOption[] = [
  { code: 1, statusTitle: "فرم تکميل نشده" },
  { code: 2, statusTitle: "فرم تکميل شده" },
  { code: 4, statusTitle: "پرداخت تائيد شده" },
  { code: 5, statusTitle: "ارسال شده" },
  { code: 7, statusTitle: "کنسل شده" },
  { code: 8, statusTitle: "پردازش انبار" },
  { code: 9, statusTitle: "اعلام پرداخت" },
  { code: 10, statusTitle: "تایید حسابداری" },
  { code: 13, statusTitle: "ارسال شده به سرویس پستی" },
  { code: 16, statusTitle: "در حال پیگیری" },
];

/** "پردازش انبار" (warehouse processing) -- the status the shortage report was originally built for. */
export const DEFAULT_SHORTAGE_REPORT_STATUS_CODES: number[] = [8];

/**
 * Selectable "how far back" presets for the shortage report -- a week, a
 * month, two months, six months. Filters by each order's Shopfa
 * *creation* date (`date`), not `payment_date` -- Shopfa's `/api/shop/
 * orders` `from`/`to` filter only narrows by creation date server-side
 * (same constraint documented on HttpShopfaClient's sold-quantity scan),
 * so this bounds "how far back to look for orders," not "orders paid in
 * this window."
 */
export const SHORTAGE_REPORT_RANGE_DAYS_VALUES = [7, 30, 60, 180] as const;
export type ShortageReportRangeDays = (typeof SHORTAGE_REPORT_RANGE_DAYS_VALUES)[number];
export const DEFAULT_SHORTAGE_REPORT_RANGE_DAYS: ShortageReportRangeDays = 30;

/**
 * One product (or product+variant) found short across one or more scanned
 * orders. `orderNumbers` are Shopfa's customer-facing order numbers (the
 * `session` field), not internal basket ids, so staff can look them up
 * directly in the Shopfa dashboard or the Order Admin Note dev tool.
 * `totalShortageQuantity` sums each contributing order's line-item
 * quantity for this product -- not a quantity parsed out of the note
 * text (Shopfa's admin notes only reliably state which item, essentially
 * never how many of it), so it answers "how many units of this item are
 * tied up across shortage-flagged orders," not "how many units are
 * physically missing."
 */
export interface ShortageReportItemDTO {
  productId: string;
  variantId: string | null;
  title: string;
  imageUrl: string | null;
  affectedOrderCount: number;
  totalShortageQuantity: number;
  oldestPaymentDateISO: string | null;
  newestPaymentDateISO: string | null;
  orderNumbers: string[];
}

/** One order whose admin note mentioned "مورد"/"موارد" but couldn't be resolved to any valid item row (e.g. "همه موارد بجز 6" -- an "all except N" phrasing the parser doesn't understand -- or an out-of-range reference). Kept with its note text so staff can review it manually. */
export interface UnresolvedShortageNoteDTO {
  orderNumber: string;
  note: string;
}

/**
 * Result of scanning every order in the given statuses for a shortage
 * signal in its admin note ("یادداشت مدیر"): an order whose note doesn't
 * mention "مورد"/"موارد" at all counts its ENTIRE item list as short
 * (`wholeOrderShortageOrderCount`); an order whose note does mention one
 * of those words but couldn't be resolved to any valid item row is
 * excluded from `items` and listed separately in `unresolvedNotes` so
 * nothing goes missing silently.
 */
export interface ShortageReportResultDTO {
  statusCodes: number[];
  days: ShortageReportRangeDays;
  /** The exact window the server resolved `days` into, so the UI can display it without relying on the client's own clock. */
  rangeFromISO: string;
  rangeToISO: string;
  totalOrdersScanned: number;
  wholeOrderShortageOrderCount: number;
  unresolvedNotes: UnresolvedShortageNoteDTO[];
  items: ShortageReportItemDTO[];
  generatedAtISO: string;
}
