import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
  SoldQuantityRangeDays,
} from "@complaint-system/shared";

/**
 * Abstraction over the external Shopfa e-commerce platform, which is the
 * source of truth for customers, orders, and products. Nothing outside of
 * this integrations/shopfa directory should know whether data is coming
 * from the real Shopfa HTTP API or the local mock provider -- consumers
 * (customerService) depend only on this interface (dependency inversion).
 */
export interface ShopfaClient {
  getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null>;
  /**
   * `phone` is an optional fallback identifier for guest customers, whose
   * externalCustomerId can't be looked up directly -- see the implementation
   * note on HttpShopfaClient.getCustomerOrderSummary.
   */
  getCustomerOrderSummary(externalCustomerId: string, phone?: string): Promise<CustomerSummaryDTO | null>;
  getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null>;
  searchCustomer(query: string): Promise<CustomerSearchResultDTO[]>;
  searchOrders(query: string): Promise<OrderSummaryDTO[]>;
  /** Used by Purchasing's Match & Register step to link a received item to a Shopfa product by its code. */
  getProductByCode(code: string): Promise<ShopfaProductLookup | null>;
  /** Free-text product search (by name) for Match & Register's "search by name and pick from a list" flow. */
  searchProducts(query: string): Promise<ShopfaProductLookup[]>;
  /**
   * Line-item quantity for a product code within a date range, broken down
   * by order status -- backs Development Tools' "total sold quantity"
   * check (see devToolsService.SOLD_STATUSES for which statuses count as
   * an actual sale; this method just reports the raw per-status facts).
   */
  getSoldQuantityBreakdown(productCode: string, range: ShopfaDateRange): Promise<ShopfaSoldQuantityResult>;
  /**
   * Changes a product's title on Shopfa -- backs Development Tools' "title
   * asterisk" toggle. Confirmed live (2026-09-15, test product 7724765)
   * that `/api/shop/product/update` genuinely applies a title-only change
   * (a minimal `{id, title}` JSON body) without touching any other field
   * -- it behaves as a partial update/merge, not a full-record replace.
   * Earlier same-day testing seemed to show this endpoint silently
   * no-opping no matter what payload was sent; that was actually caused by
   * `SHOPFA_API_BASE_URL` carrying a `www.` prefix that 301-redirects to
   * the bare host, and axios downgrades a redirected POST to a bodyless
   * GET, silently dropping the title (see the shopfa-api-testing-fixtures
   * memory). The result is still verified by re-fetching the product
   * rather than trusted from the update call's own response, since that
   * response reports `successful: true` unconditionally either way.
   */
  updateProductTitle(productCode: string, title: string): Promise<ShopfaProductLookup | null>;
  /**
   * Reads an order's admin note ("یادداشت مدیر" in the Shopfa dashboard) --
   * backs Development Tools' order-note tool. Confirmed live (2026-09-16,
   * test order session 4783608554 / basket 21134791) that this is exposed
   * under the response key `note` on /api/shop/orders and
   * /api/shop/orders/details, but ONLY when explicitly requested via the
   * `fields` query param -- unlike every other order field, it's never
   * included by default. Looked up by orderNumber (Shopfa's
   * customer-facing `session` field, what staff actually have on hand),
   * not the internal basket id.
   */
  getOrderAdminNote(orderNumber: string): Promise<ShopfaOrderAdminNote | null>;
  /**
   * Sets an order's admin note. Confirmed live that the write key is also
   * `note` (in the JSON body of /api/shop/orders/update, alongside `id`)
   * -- NOT `description`, despite `description` appearing in Shopfa's own
   * published OpenAPI example for this endpoint's body; a `description`
   * write was tested on the same order and silently no-opped. The result
   * is re-fetched and compared rather than trusted from the update call's
   * own response, matching updateProductTitle's `applied` pattern above,
   * since /orders/update also reports `successful: true` unconditionally.
   */
  updateOrderAdminNote(orderNumber: string, note: string): Promise<ShopfaOrderAdminNote | null>;
  /**
   * Every order currently in one of the given Shopfa status codes, with
   * its admin note, items (including thumbnails), and payment/creation
   * dates -- backs Reporting's shortage report. Live-API only: imported
   * order data has no admin-note field and doesn't share Shopfa's numeric
   * status codes at all (see getOrderAdminNote above for the same
   * Live-API-only reasoning). One Shopfa call per status code is
   * required -- confirmed live that `/api/shop/orders`' `status` filter
   * rejects a comma-separated list of codes. `range` bounds the scan by
   * each order's creation date (server-side `from`/`to`, confirmed live
   * to combine correctly with `status`) -- see
   * SHORTAGE_REPORT_RANGE_DAYS_VALUES for why creation date, not
   * `payment_date`.
   */
  listOrdersByStatusForShortageReport(
    statusCodes: number[],
    range: ShopfaOrderDateWindow,
  ): Promise<ShopfaShortageReportOrder[]>;
  /**
   * Every order currently in one of the given Shopfa status codes, with its
   * admin note, buyer name, order date, and items (including thumbnails and
   * per-item quantity) -- backs Order Precheck's one-order-at-a-time queue.
   * Unlike listOrdersByStatusForShortageReport, this is not bounded to a
   * date range: Order Precheck's default status ("پرداخت تائيد شده") and its
   * "پردازش انبار" resume path are both actively-managed operational queues
   * expected to stay small, not a historical scan. Live-API only, same
   * reasoning as getOrderAdminNote/listOrdersByStatusForShortageReport.
   */
  listOrdersByStatusForPrecheck(statusCodes: number[]): Promise<ShopfaPrecheckOrder[]>;
  /**
   * Writes an order's admin note and status together in one Shopfa call --
   * backs Order Precheck's "save" action, which always needs both applied
   * atomically (the note records which items were unavailable, the status
   * reflects whether the order can move straight to the postal service or
   * needs warehouse attention). Follows the same conventions as
   * updateOrderAdminNote: `id` doubles in the query string and JSON body,
   * and the result is re-fetched and compared rather than trusted from the
   * update call's own response (`successful: true` regardless).
   *
   * Confirmed live (2026-09-16, test order session 4783608554): writing
   * `status` as a plain numeric code (the same ones SHOPFA_ORDER_STATUS_OPTIONS
   * uses) in the same JSON body as `note` genuinely applies both -- the
   * order's status_title came back as "پردازش انبار" (code 8) after a save,
   * matching the code sent, alongside the note change. The same test also
   * surfaced a separate, real bug: Shopfa HTML-entity-encodes the note on
   * write (a literal `"` character came back as `&quot;`), which broke an
   * earlier JSON-based marker format -- see orderPrecheckNoteMarker.ts for
   * why the marker is a bare comma-separated list instead.
   */
  updateOrderNoteAndStatus(
    orderNumber: string,
    update: ShopfaOrderPrecheckUpdate,
  ): Promise<ShopfaOrderPrecheckUpdateResult | null>;
  /**
   * Every order currently in the given Shopfa status code, with buyer name,
   * order date, and items (thumbnails + quantity) -- backs Packing's
   * one-order-at-a-time queue. Deliberately omits the admin note (Packing
   * never reads or writes it, unlike Order Precheck): requesting `note` via
   * `fields` is the specific thing that forces small page sizes on
   * listOrdersByStatusForPrecheck/ForShortageReport (see those methods'
   * docs), so leaving it out here lets this method page at the client's
   * normal, faster size. `range` bounds the scan by each order's *creation*
   * date, the only date Shopfa's `status` filter can be combined with
   * server-side (same constraint as listOrdersByStatusForShortageReport) --
   * not by when the order actually entered this status.
   */
  listOrdersByStatusForPacking(statusCode: number, range: ShopfaOrderDateWindow | null): Promise<ShopfaPackingOrder[]>;
  /**
   * How many orders are in `statusCode` on Shopfa right now, with no time
   * window (Shopfa's `total_count`) -- lets the UI show "N of TOTAL" when a
   * window hides some. Null when it couldn't be read (never throws).
   */
  countOrdersInStatus(statusCode: number): Promise<number | null>;
  /**
   * Orders whose customer name or mobile matches `query`, with line items --
   * backs Reporting's customer report. Confirmed live (2026-09-20) that
   * `/api/shop/orders?search=` matches buyer name/family/mobile by
   * substring server-side (unlike `mobile=`, which needs an exact full
   * number). `range` is applied per order by its effective date (payment
   * date when paid, else creation date); the server-side fetch window is
   * padded backward by PAYMENT_DATE_LOOKBACK_BUFFER_DAYS -- see
   * HttpShopfaClient.scanOrdersForSoldQuantity for why. Live-API only.
   */
  listOrdersForCustomerReport(query: string, range: ShopfaOrderDateWindow): Promise<ShopfaCustomerReportScan>;
  /**
   * Per-product units/revenue sold in the window (sold-status orders only,
   * windowed by effective date) -- backs Reporting's item sales report.
   * Shopfa has no server-side filter by product or category, so this pages
   * through every order in the window (cached briefly per window). Live-API only.
   */
  listSoldItemsForReport(range: ShopfaOrderDateWindow): Promise<ShopfaItemSalesEntry[]>;
  /** Same scan as listSoldItemsForReport, but per product per store-local day -- backs the category sales chart. Live-API only. */
  listSoldItemsByDay(range: ShopfaOrderDateWindow): Promise<ShopfaSoldItemDayRow[]>;
  /** Every product category (Shopfa "page" of the product module, `/api/system/pages`, module 2102). Live-API only. */
  listShopCategories(): Promise<ShopfaCategory[]>;
  /** Ids of every product directly assigned to the category (`/api/shop/product/list?page_id=`; sub-categories are NOT included -- the caller expands the tree). Live-API only. */
  listProductIdsInCategory(categoryId: string): Promise<string[]>;
  /**
   * Writes only an order's status, leaving its admin note untouched -- backs
   * Packing's "send" action. Uses the same partial-update/merge semantics
   * already confirmed for updateProductTitle (a minimal `{id, title}` body
   * changes only that field) and updateOrderNoteAndStatus (confirmed live
   * that adding `status` alongside `note` in one write applies both) --
   * sending `status` alone is expected to leave `note` alone by the same
   * merge behavior, though this specific omit-note case hasn't been
   * separately confirmed live. The result is re-fetched and compared rather
   * than trusted from the update call's own response, same as every other
   * write on this interface.
   */
  updateOrderStatus(orderNumber: string, statusCode: number): Promise<ShopfaOrderStatusUpdateResult | null>;
  /**
   * Lightweight (no items, no admin note) list of every order in the given
   * status codes with just enough to identify the customer -- backs
   * Packing's "this customer has other orders still pending" flag. `range`
   * is the same creation-date window Packing's queue uses (null = all time),
   * so the check never looks further back than the time frame staff selected.
   */
  listOrdersByStatusesForCustomerLookup(
    statusCodes: number[],
    range: ShopfaOrderDateWindow | null,
  ): Promise<ShopfaCustomerOrderRef[]>;
  /**
   * Looks up one order by its customer-facing order number (Shopfa's
   * `session`), including its admin note and items -- backs Reporting's
   * order details page, opened from the shortage report's order links.
   * Live-API only for the same reasons as getOrderAdminNote.
   */
  getOrderDetailsByNumber(orderNumber: string): Promise<ShopfaOrderDetails | null>;
  /**
   * Every order (any status, any date) whose buyer name/family/mobile
   * contains `query` -- confirmed live (2026-09-20) that `search=` matches
   * those fields by substring server-side. Callers narrow the results to the
   * exact customer themselves (see utils/customerMatching). Capped at a few
   * pages of the most recent matches. Backs Order Precheck's "same customer's
   * other orders" rules. Live-API only.
   */
  findOrdersByCustomerQuery(query: string): Promise<ShopfaCustomerOrderRef[]>;
  /**
   * Every order in any of the given status codes, summarized (customer,
   * dates, shipping method, item/quantity totals) -- backs the "Orders by
   * status" overview. One scan per status code (Shopfa's `status` filter
   * takes a single code), bounded by `range` on the order's LAST-UPDATED
   * date (the deliberate default behavior of Shopfa's `from`/`to` when no
   * `sort` is sent, confirmed live 2026-09-21) -- this overview is about
   * recent activity, unlike the creation-date windows of Precheck/Packing.
   * No `note` requested so it pages at 500. Live-API only.
   */
  listOrdersByStatuses(statusCodes: number[], range: ShopfaOrderDateWindow | null): Promise<ShopfaStatusOrder[]>;
}

export interface ShopfaPackingOrderItem {
  productCode: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
}

export interface ShopfaPackingOrder {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  /** Shipping method display name; the HTTP client resolves it from the method id when the order itself carries no title. */
  shippingMethod: string | null;
  shippingMethodId: string | null;
  orderDate: Date | null;
  /** When payment was confirmed -- what Order Precheck/Packing queues are ordered by (oldest payment first); null for orders never paid. */
  paymentDate: Date | null;
  statusCode: number;
  statusTitle: string;
  items: ShopfaPackingOrderItem[];
}

export interface ShopfaOrderStatusUpdateResult {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
}

/** A precheck-shaped order plus its payment date, for Reporting's order details page. */
export interface ShopfaOrderDetails extends ShopfaPrecheckOrder {
  paymentDate: Date | null;
}

export interface ShopfaPrecheckOrderItem {
  productCode: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
}

export interface ShopfaPrecheckOrder {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  orderDate: Date | null;
  /** When payment was confirmed -- what Order Precheck/Packing queues are ordered by (oldest payment first); null for orders never paid. */
  paymentDate: Date | null;
  note: string;
  statusCode: number;
  statusTitle: string;
  items: ShopfaPrecheckOrderItem[];
}

export interface ShopfaOrderPrecheckUpdate {
  note: string;
  statusCode: number;
}

export interface ShopfaOrderPrecheckUpdateResult {
  externalOrderId: string;
  orderNumber: string;
  note: string;
  statusCode: number;
  statusTitle: string;
}

export interface ShopfaOrderDateWindow {
  from: Date;
  to: Date;
}

export interface ShopfaOrderAdminNote {
  externalOrderId: string;
  orderNumber: string;
  note: string;
}

export interface ShopfaShortageReportOrderItem {
  productId: string;
  variantId: string | null;
  title: string;
  imageUrl: string | null;
  quantity: number;
}

export interface ShopfaShortageReportOrder {
  externalOrderId: string;
  orderNumber: string;
  note: string;
  paymentDate: Date | null;
  createdDate: Date | null;
  items: ShopfaShortageReportOrderItem[];
}

export interface ShopfaCustomerReportOrder {
  orderNumber: string;
  statusTitle: string;
  buyerName: string;
  mobile: string | null;
  orderDate: Date | null;
  paymentDate: Date | null;
  totalAmount: number;
  items: Array<{ productId: string; title: string; quantity: number; unitPrice: number; amount: number }>;
}

export interface ShopfaCustomerReportScan {
  orders: ShopfaCustomerReportOrder[];
  /** True when the scan stopped at its page cap before exhausting the search results. */
  truncated: boolean;
}

/** Per-product totals across sold-status orders whose effective date (payment date, else creation date) falls in the scanned window. */
export interface ShopfaItemSalesEntry {
  productId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  revenue: number;
  orderCount: number;
}

/** One product's sold-status sales on one store-local day (YYYY-MM-DD) -- the raw material for time-bucketed reports. */
export interface ShopfaSoldItemDayRow extends ShopfaItemSalesEntry {
  day: string;
}

export interface ShopfaCategory {
  id: string;
  title: string;
  parentId: string;
  /** Position in the store's own category menu (Shopfa's `order`). */
  order: number;
}

export interface ShopfaDateRange {
  /** The selected preset, doubling as the cache bucket key for implementations that cache the underlying order scan (see HttpShopfaClient) -- from/to are always "now" minus this many days, so two calls with the same `days` are the same logical window. */
  days: SoldQuantityRangeDays;
  from: Date;
  to: Date;
}

export interface ShopfaSoldQuantityStatusRow {
  status: string;
  quantity: number;
  orderCount: number;
}

export interface ShopfaSoldQuantityResult {
  rows: ShopfaSoldQuantityStatusRow[];
  /** When the underlying order data was actually pulled from Shopfa -- may be well before "now" when served from HttpShopfaClient's cache. */
  fetchedAt: Date;
  /** True when this result was reused from a still-fresh cache instead of re-scanning live orders (always false for clients that don't cache, e.g. ImportedOrdersShopfaClient/MockShopfaClient, since those are already fast local lookups). */
  servedFromCache: boolean;
}

export interface ShopfaProductLookup {
  shopfaProductId: string;
  productCode: string;
  title: string;
  sku: string | null;
  price: number;
  imageUrl?: string | null;
  /** Current stock count on Shopfa, shown to the user while confirming a match. Null when the data source can't provide it (see ImportedOrdersShopfaClient). */
  availableQuantity: number | null;
}

/** Raw shapes as returned by the real Shopfa REST API (subject to Shopfa's own conventions). */
export interface ShopfaRawCustomer {
  id: string;
  full_name: string;
  phone_number?: string;
  email?: string;
  orders_count: number;
  total_spent: string;
  currency: string;
  last_order_at: string | null;
}

export interface ShopfaRawOrderItem {
  item_id: string;
  sku: string;
  title: string;
  quantity: number;
}

export interface ShopfaRawOrder {
  id: string;
  order_number: string;
  customer_id: string;
  created_at: string;
  status: string;
  total: string;
  currency: string;
  items: ShopfaRawOrderItem[];
  /** Mutable so MockShopfaClient.updateOrderAdminNote can simulate a real write -- see ShopfaClient.updateOrderAdminNote. */
  note?: string;
}

export interface ShopfaCustomerOrderRef {
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  statusCode: number;
  statusTitle: string;
}

export interface ShopfaStatusOrder {
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  orderDate: Date | null;
  paymentDate: Date | null;
  /** Shopfa's `update`: last modification of the order. */
  updatedAt: Date | null;
  statusCode: number;
  statusTitle: string;
  /** Resolved name, like ShopfaPackingOrder.shippingMethod. */
  shippingMethod: string | null;
  shippingMethodId: string | null;
  itemCount: number;
  totalQuantity: number;
}
