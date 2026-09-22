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
  { code: 0, statusTitle: "حذف شده" },
  { code: 1, statusTitle: "فرم تکميل نشده" },
  { code: 2, statusTitle: "فرم تکميل شده" },
  { code: 3, statusTitle: "پرداخت شده" },
  { code: 4, statusTitle: "پرداخت تائيد شده" },
  { code: 5, statusTitle: "ارسال شده" },
  { code: 6, statusTitle: "تحويل داده شده" },
  { code: 7, statusTitle: "کنسل شده" },
  { code: 8, statusTitle: "پردازش انبار" },
  { code: 9, statusTitle: "اعلام پرداخت" },
  { code: 10, statusTitle: "تایید حسابداری" },
  { code: 11, statusTitle: "چاپ فاکتور" },
  { code: 13, statusTitle: "ارسال شده به سرویس پستی" },
  { code: 15, statusTitle: "ثبت شده" },
  { code: 16, statusTitle: "در حال پیگیری" },
  { code: 17, statusTitle: "در انتظار واریز" },
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

/** One line item of an order shown on Reporting's order details page. */
export interface ReportingOrderItemDTO {
  productId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
}

/** A single live Shopfa order, looked up by its customer-facing order number -- opened from the shortage report's order-number links. */
export interface ReportingOrderDetailsDTO {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  orderDateISO: string | null;
  paymentDateISO: string | null;
  statusCode: number;
  statusTitle: string;
  note: string;
  items: ReportingOrderItemDTO[];
}

/**
 * Customer report: every order matching a name/mobile search within a date
 * window, grouped into one entry per distinct customer (Shopfa's `search`
 * matches by substring, so a name like "سعید" can match several people).
 * Customers are identified by mobile number when present, else by name --
 * NOT by Shopfa's `user_id`, because one account can place orders on
 * behalf of other people (different name/mobile per order).
 *
 * `totalSpent`/`soldOrderCount` count only orders in a "sold" status
 * (see SOLD_ORDER_STATUS_TITLES); orders in any other status (cancelled,
 * abandoned checkout, ...) are still listed so staff see the full history,
 * flagged `counted: false`. The date window applies to each order's
 * effective date: its payment date when paid, else its creation date.
 */
export interface CustomerReportOrderDTO {
  orderNumber: string;
  statusTitle: string;
  /** Whether this order's status counts as an actual sale -- see SOLD_ORDER_STATUS_TITLES. */
  counted: boolean;
  orderDateISO: string | null;
  paymentDateISO: string | null;
  totalAmount: number;
  itemCount: number;
  items: Array<{ productId: string; title: string; quantity: number; unitPrice: number; amount: number }>;
}

export interface CustomerReportCustomerDTO {
  name: string;
  mobile: string | null;
  orderCount: number;
  soldOrderCount: number;
  totalSpent: number;
  soldItemCount: number;
  orders: CustomerReportOrderDTO[];
}

export interface CustomerReportResultDTO {
  query: string;
  rangeFromISO: string;
  rangeToISO: string;
  customers: CustomerReportCustomerDTO[];
  /** True when the result hit the server's safety cap on scanned orders (a very broad query), so it may be incomplete -- narrow the search or the dates. */
  truncated: boolean;
  generatedAtISO: string;
}

/** Statuses (Shopfa `status_title`) that count as an actual completed sale -- mirrors devToolsService's SOLD_STATUSES (Arabic yeh/hamza spelling of "پرداخت تائيد شده" is intentional, it is how Shopfa reports it). */
export const SOLD_ORDER_STATUS_TITLES: readonly string[] = [
  "ارسال شده",
  "پردازش انبار",
  "تایید حسابداری",
  "ارسال شده به سرویس پستی",
  "پرداخت تائيد شده",
  "اعلام پرداخت",
];

/** One Shopfa product category (a "page" of the product module), for the item-sales report's category picker. `parentId` is 0 for a top-level category. */
export interface ItemSalesCategoryDTO {
  id: string;
  title: string;
  parentId: string;
  /** Position in the store's own category menu (Shopfa's `order`). */
  order: number;
}

/** Units and revenue sold of one product within the window. */
export interface ItemSalesRowDTO {
  productId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  /** Sum of the line items' `sum_price` (Rials/Tomans as Shopfa reports them). */
  revenue: number;
  orderCount: number;
}

/**
 * Item sales report: how many units of one product, or of every product in
 * a category (including its sub-categories), were sold in the window.
 * Counts only orders in a sold status and scopes the window by payment date
 * -- see SOLD_ORDER_STATUS_TITLES and the payment-date rule on
 * CustomerReportOrderDTO.
 */
export interface ItemSalesResultDTO {
  scope: "product" | "category";
  /** Product title or category title (with the number of sub-categories included, if any, reflected in `categoryCount`). */
  label: string;
  categoryCount: number;
  rangeFromISO: string;
  rangeToISO: string;
  totalQuantity: number;
  totalRevenue: number;
  /** Distinct orders containing the product; null for a category, where per-product order counts overlap and can't be summed. */
  orderCount: number | null;
  /** Number of products in the category that had at least one sale. */
  productsSold: number;
  rows: ItemSalesRowDTO[];
  generatedAtISO: string;
}

/** A product offered by the item-sales report's product picker. */
export interface ItemSalesProductSearchResultDTO {
  productId: string;
  title: string;
  imageUrl: string | null;
}

/**
 * Selectable windows for the category sales chart. `days` is a whole
 * multiple of every step in `stepOptions` (`stepDays` is the default), so the window splits into equal buckets ending
 * today: 1 month = 10 x 3-day buckets, 3 months = 18 x 5-day, 6 months =
 * 18 x 10-day, 12 months = 12 x 30-day (a "month" here is 30 days, so a
 * 12-month window is 360 days).
 */
export const CATEGORY_TREND_WINDOWS = [
  { months: 1, days: 30, stepDays: 3, stepOptions: [1, 2, 3, 5, 10, 15] },
  { months: 3, days: 90, stepDays: 5, stepOptions: [3, 5, 10, 15, 30] },
  { months: 6, days: 180, stepDays: 10, stepOptions: [5, 10, 15, 30] },
  { months: 12, days: 360, stepDays: 30, stepOptions: [10, 15, 30] },
] as const;
export type CategoryTrendMonths = (typeof CATEGORY_TREND_WINDOWS)[number]["months"];
export const DEFAULT_CATEGORY_TREND_MONTHS: CategoryTrendMonths = 3;

/** Inclusive store-local (Iran time) day span of one chart bucket, as YYYY-MM-DD. */
export interface CategoryTrendBucketDTO {
  startDate: string;
  endDate: string;
}

/**
 * One chart series: a product category, or the folded "other" series
 * (`categoryId` "other") holding every category beyond the first
 * CATEGORY_TREND_COLOR_SLOTS in the store's category order, plus products
 * that belong to no category. `quantity`/`revenue` have one value per
 * bucket. Categories are the store's top-level product categories, or --
 * where a top-level category has sub-categories, as with the store's
 * "accessories" root -- its direct sub-categories, with deeper levels
 * rolled up into them. Same counting rules as ItemSalesResultDTO (sold
 * statuses only, payment-date windows).
 */
export interface CategoryTrendSeriesDTO {
  categoryId: string;
  title: string;
  /**
   * Fixed palette slot (0-based) of this category, decided by the store's own category order and
   * independent of the window, measure or what sold -- so a category keeps one color across every
   * chart. Null for the folded "other" series, which is always neutral gray.
   */
  colorSlot: number | null;
  totalQuantity: number;
  totalRevenue: number;
  quantity: number[];
  revenue: number[];
}

export interface CategoryTrendResultDTO {
  months: CategoryTrendMonths;
  stepDays: number;
  rangeFromISO: string;
  rangeToISO: string;
  buckets: CategoryTrendBucketDTO[];
  /** In the store's category order (stable across windows); "other" (when present) is always last. */
  series: CategoryTrendSeriesDTO[];
  generatedAtISO: string;
}

/** Number of distinct category hues in the trend chart palette; categories past this many (in store order) fold into "other". */
export const CATEGORY_TREND_COLOR_SLOTS = 8;
