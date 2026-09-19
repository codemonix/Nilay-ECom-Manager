/**
 * Packing: a warehouse-facing screen that walks staff through every order
 * sitting in "ارسال شده به سرویس پستی" (sent to postal service) one order
 * at a time. Unlike Order Precheck, there's no admin-note bookkeeping here
 * -- each item is just tapped to toggle its frame between unpacked
 * (orange) and packed (green) for the current session, and once every item
 * is green the order can be sent, which moves it to "ارسال شده" (shipped)
 * and advances to the next order. Live-API only, same as Order Precheck and
 * Reporting's shortage report.
 */
export interface PackingItemDTO {
  productCode: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
}

export interface PackingOrderDTO {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  orderDateISO: string | null;
  statusCode: number;
  statusTitle: string;
  items: PackingItemDTO[];
}

export interface PackingListResultDTO {
  days: PackingRangeDays;
  /** The exact window the server resolved `days` into, so the UI can display it without relying on the client's own clock. */
  rangeFromISO: string;
  rangeToISO: string;
  orders: PackingOrderDTO[];
  generatedAtISO: string;
}

export interface SendPackedOrderResultDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
  packingRecordId: string;
  photoUrl: string | null;
}

/**
 * A locally-kept record of one order Packing has sent, independent of
 * Shopfa -- live-API orders are never persisted locally otherwise, so this
 * is the only place packing history (including the confirmation photo) can
 * be browsed after the fact. `items` is a denormalized snapshot taken at
 * send time, not a live reference to the order.
 */
export interface PackingRecordItemDTO {
  productCode: string;
  title: string;
  quantity: number;
}

export interface PackingRecordDTO {
  id: string;
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  items: PackingRecordItemDTO[];
  statusCodeAfterSend: number;
  statusTitleAfterSend: string;
  sentByName: string | null;
  sentAtISO: string;
  /** Null when staff sent the order without taking a confirmation photo (the explicit "Confirm" override on the warning dialog). */
  photoUrl: string | null;
}

export interface PackingRecordListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

/** "ارسال شده به سرویس پستی" (sent to postal service) -- the only status Packing's queue shows. */
export const PACKING_SOURCE_STATUS_CODE = 13;

/** "ارسال شده" (shipped) -- where an order lands once every item has been physically packed and confirmed. */
export const PACKING_SENT_STATUS_CODE = 5;

/**
 * Selectable "how far back" presets for Packing's queue -- the same
 * day-count presets as the Shortage Report, and for the same reason:
 * Shopfa's `/api/shop/orders` `from`/`to` filter only narrows by order
 * *creation* date server-side, not by when an order actually entered
 * "ارسال شده به سرویس پستی", so this bounds "how far back to look for
 * orders in that status," not "orders that entered the status in this
 * window."
 */
export const PACKING_RANGE_DAYS_VALUES = [7, 30, 60, 180] as const;
export type PackingRangeDays = (typeof PACKING_RANGE_DAYS_VALUES)[number];
/** "2 months" -- the requested default, so stale orders don't clutter the queue unless a wider window is explicitly chosen. */
export const DEFAULT_PACKING_RANGE_DAYS: PackingRangeDays = 60;
