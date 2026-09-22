/**
 * Order Precheck: a warehouse-facing screen that walks staff through every
 * order sitting in "پرداخت تائيد شده" (payment confirmed, the default
 * filter -- selectable manually to any other Shopfa status) one order at a
 * time, has them mark each line item available/unavailable, and on save
 * either advances the order straight to "ارسال شده به سرویس پستی" (every
 * item available) or bounces it to "پردازش انبار" (warehouse processing)
 * with the unavailable items' product codes written into the order's admin
 * note ("یادداشت مدیر") -- see orderPrecheckNoteMarker.ts (apps/api) for the
 * exact note format. Reopening an order that's back in "پردازش انبار"
 * restores each item's available/unavailable choice from that same marker,
 * so staff only need to re-decide items whose availability actually
 * changed. Live-API only, same as Reporting's shortage report -- imported
 * order data has neither Shopfa's numeric status codes nor an admin-note
 * field.
 */
export interface OrderPrecheckItemDTO {
  productCode: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  /** null when this order's note carries no prior Order Precheck marker to restore from (a fresh order, or one in this status for an unrelated reason) -- the UI should treat this as "not yet decided," not "unavailable." */
  available: boolean | null;
}

export interface OrderPrecheckOrderDTO {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  orderDateISO: string | null;
  statusCode: number;
  statusTitle: string;
  /** True when this order's admin note carried a prior Order Precheck marker (see orderPrecheckNoteMarker.ts) that every item's `available` below was restored from -- lets the UI tell staff "this was already precheck'd, here's what was decided" instead of looking indistinguishable from a fresh order. */
  restoredFromPreviousPrecheck: boolean;
  items: OrderPrecheckItemDTO[];
}

export interface OrderPrecheckListResultDTO {
  statusCodes: number[];
  orders: OrderPrecheckOrderDTO[];
  generatedAtISO: string;
}

export interface SaveOrderPrecheckItemInput {
  productCode: string;
  available: boolean;
}

export interface SaveOrderPrecheckRequestDTO {
  items: SaveOrderPrecheckItemInput[];
  /** Set on the second call after the user accepted the warning that other orders of the same customer will change status too (see SaveOrderPrecheckResultDTO.saved). */
  confirmStatusChanges?: boolean;
}

/** Another order of the same customer whose status a precheck save changes (or, while `saved` is false, would change). */
export interface OrderPrecheckRelatedOrderDTO {
  orderNumber: string;
  fromStatusTitle: string;
  toStatusCode: number;
  toStatusTitle: string;
}

export interface SaveOrderPrecheckResultDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
  unavailableProductCodes: string[];
  /** False when nothing was changed because the user must first confirm that other orders of this customer will change status -- call again with confirmStatusChanges. */
  saved: boolean;
  relatedOrders: OrderPrecheckRelatedOrderDTO[];
  /** Related orders whose status change failed (the checked order itself was still saved). */
  relatedFailures: { orderNumber: string; message: string }[];
}

/** "پرداخت تائيد شده" (payment confirmed) -- the status Order Precheck's queue defaults to. */
export const ORDER_PRECHECK_DEFAULT_STATUS_CODES: number[] = [4];

/** "تایید حسابداری" (accounting confirmed) -- where a fully-available order waits while the same customer still has other orders not yet prechecked (in the pending statuses below). */
export const ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE = 10;

/** "پرداخت تائيد شده" (4), "پردازش انبار" (8), "اعلام پرداخت" (9): orders of the same customer in these statuses are still waiting on precheck/stock, so a fully-available order is parked in accounting-confirmed instead of being sent to the postal service. */
export const ORDER_PRECHECK_CUSTOMER_PENDING_STATUS_CODES: number[] = [4, 8, 9];

/** "ارسال شده به سرویس پستی" (sent to postal service) -- where a save lands an order once every item was marked available. */
export const ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE = 13;

/** "پردازش انبار" (warehouse processing) -- where a save lands an order that has at least one unavailable item; also the status staff reopen to resume a precheck already in progress. */
export const ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE = 8;
