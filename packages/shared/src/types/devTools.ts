/** One line-item candidate surfaced by the Development Tools "search by name" flow, sourced live from Shopfa. */
export interface SoldItemSearchResultDTO {
  productCode: string;
  sku: string | null;
  title: string;
}

/** Quantity and order count for a product code within one order status, plus whether that status counts toward the "sold" total. */
export interface SoldQuantityStatusBreakdownDTO {
  status: string;
  quantity: number;
  orderCount: number;
  countedInTotal: boolean;
}

/**
 * Total quantity sold for a product code within a time frame, summed across
 * orders whose status counts as an actual sale, plus the full per-status
 * breakdown. `rangeFromISO`/`rangeToISO` echo back the exact window the
 * server resolved `days` into, so the UI can display it without relying on
 * the client's own clock.
 */
export interface SoldQuantityResultDTO {
  productCode: string;
  title: string | null;
  days: SoldQuantityRangeDays;
  rangeFromISO: string;
  rangeToISO: string;
  totalQuantity: number;
  orderCount: number;
  byStatus: SoldQuantityStatusBreakdownDTO[];
  /** When the underlying order data was actually fetched from Shopfa -- may be earlier than "now" when served from cache (see fromCache). */
  fetchedAtISO: string;
  /** True when this result reused a still-fresh cached scan of live orders instead of re-fetching (see CACHE_TTL_MS on HttpShopfaClient). */
  fromCache: boolean;
}

/** Selectable "how far back" presets for the Development Tools sold-quantity check -- kept as a shared constant so the API validator and the web UI's select options can't drift apart. */
export const SOLD_QUANTITY_RANGE_DAYS_VALUES = [1, 2, 3, 7, 14, 30, 60, 90, 180] as const;
export type SoldQuantityRangeDays = (typeof SOLD_QUANTITY_RANGE_DAYS_VALUES)[number];

/**
 * Result of Development Tools' "title asterisk" check: does this product's
 * title currently end in "*" (see shopfaTitleEndsWithAsterisk).
 * `adminEditUrl` links straight to that product's edit screen in the
 * Shopfa admin dashboard, as a manual fallback if the toggle (see
 * ToggleTitleAsteriskResultDTO) ever fails.
 */
export interface TitleAsteriskCheckResultDTO {
  productCode: string;
  title: string;
  hasAsterisk: boolean;
  adminEditUrl: string;
}

/**
 * Result of toggling a product's trailing "*". `applied` reflects the
 * title Shopfa actually reports back after the write (re-fetched, not
 * trusted from the update call's own response) -- see
 * ShopfaClient.updateProductTitle for why that response can't be trusted
 * on its own.
 */
export interface ToggleTitleAsteriskResultDTO {
  productCode: string;
  previousTitle: string;
  requestedTitle: string;
  currentTitle: string;
  hasAsterisk: boolean;
  applied: boolean;
}

/**
 * An order's admin note -- "یادداشت مدیر" in the Shopfa dashboard --
 * looked up by the order's customer-facing order number. See
 * ShopfaClient.getOrderAdminNote for the confirmed-live details of how
 * this is actually read from Shopfa (it's exposed under a `note` key that
 * has to be explicitly requested, unlike every other order field).
 */
export interface OrderAdminNoteDTO {
  externalOrderId: string;
  orderNumber: string;
  note: string;
}

/**
 * Result of updating an order's admin note. `applied` reflects the note
 * Shopfa actually reports back after the write (re-fetched, not trusted
 * from the update call's own response) -- same reasoning as
 * ToggleTitleAsteriskResultDTO.applied.
 */
export interface UpdateOrderAdminNoteResultDTO {
  externalOrderId: string;
  orderNumber: string;
  previousNote: string;
  requestedNote: string;
  currentNote: string;
  applied: boolean;
}
