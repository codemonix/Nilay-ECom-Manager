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
}

export interface SaveOrderPrecheckResultDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
  unavailableProductCodes: string[];
}

/** "پرداخت تائيد شده" (payment confirmed) -- the status Order Precheck's queue defaults to. */
export const ORDER_PRECHECK_DEFAULT_STATUS_CODES: number[] = [4];

/** "ارسال شده به سرویس پستی" (sent to postal service) -- where a save lands an order once every item was marked available. */
export const ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE = 13;

/** "پردازش انبار" (warehouse processing) -- where a save lands an order that has at least one unavailable item; also the status staff reopen to resume a precheck already in progress. */
export const ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE = 8;
