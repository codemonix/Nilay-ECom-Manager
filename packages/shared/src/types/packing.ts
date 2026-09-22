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

export interface PackingPendingOrderDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
}

export interface PackingOrderDTO {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  /** How this order ships (Shopfa's `post_method_title`, e.g. Tipax); null when none was selected. */
  shippingMethod: string | null;
  /** The same customer's OTHER orders still in a not-yet-shippable status (see PACKING_CUSTOMER_PENDING_STATUS_CODES) -- worth a look before boxing this one. */
  pendingOrders: PackingPendingOrderDTO[];
  /** Orders sharing this key belong to the same customer (matched by mobile number, else by name) and are placed next to each other in the queue so they can be packed together. */
  customerGroupKey: string;
  orderDateISO: string | null;
  statusCode: number;
  statusTitle: string;
  items: PackingItemDTO[];
}

export interface PackingListResultDTO {
  days: PackingRangeDays;
  /** The exact window the server resolved `days` into (null for "all time"), so the UI can display it without relying on the client's own clock. */
  rangeFromISO: string | null;
  rangeToISO: string | null;
  /** Every order currently in the queue's status on Shopfa, regardless of the time window -- so the UI can show "N of TOTAL" when the window hides some. Null if it couldn't be read. */
  statusTotal: number | null;
  orders: PackingOrderDTO[];
  /** True when looking up the customers' other pending orders failed -- `pendingOrders` is then empty for every order, which does NOT mean the customers have none. */
  pendingLookupFailed: boolean;
  generatedAtISO: string;
}

export interface SendPackedOrderResultDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
  packingRecordId: string;
  photoUrls: string[];
}

/** Result of sending a whole customer group: orders are sent one by one, so some can succeed while others fail (e.g. Shopfa hiccup) -- the UI removes `sent` orders and keeps `failed` ones. */
export interface SendPackedOrdersResultDTO {
  sent: SendPackedOrderResultDTO[];
  failed: { orderNumber: string; message: string }[];
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
  /** Confirmation photos of the customer group this order was sent with (oldest first); empty when staff chose "save and continue" without taking any. */
  photoUrls: string[];
}

export interface PackingRecordListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

/** "ارسال شده به سرویس پستی" (sent to postal service) -- the only status Packing's queue shows. */
export const PACKING_SOURCE_STATUS_CODE = 13;

/** "پردازش انبار" (8), "اعلام پرداخت" (9), "پرداخت تائيد شده" (4): a customer's orders in these statuses aren't ready to ship yet, and Packing flags them next to that customer's ready orders. */
export const PACKING_CUSTOMER_PENDING_STATUS_CODES: number[] = [8, 9, 4];

/** "ارسال شده" (shipped) -- where an order lands once every item has been physically packed and confirmed. */
export const PACKING_SENT_STATUS_CODE = 5;

/**
 * Selectable "how far back" presets for Packing's queue. `0` means ALL TIME
 * (no window) and is the default: the queue is "every order currently in
 * "ارسال شده به سرویس پستی"", so a window can only hide real work (an order
 * stuck there for months is exactly the one that must not be forgotten). The
 * day presets remain for staff who want a narrower view. When a preset is
 * used, Shopfa's `from`/`to` are sent together with `sort=date`, which
 * confirmed live (2026-09-21) makes the filter apply to the order's
 * *creation* date -- without a `sort` the same params filter by last-updated
 * date instead.
 */
export const PACKING_RANGE_DAYS_VALUES = [0, 7, 30, 60, 180] as const;
export type PackingRangeDays = (typeof PACKING_RANGE_DAYS_VALUES)[number];
/** 0 = all time (see PACKING_RANGE_DAYS_VALUES). */
export const DEFAULT_PACKING_RANGE_DAYS: PackingRangeDays = 0;
