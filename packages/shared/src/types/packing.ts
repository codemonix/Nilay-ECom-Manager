import { OrderWorkflowStatus, type ShopfaSyncStatus } from "./orderWorkflow";

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

/** One of the customer's orders that is NOT in the packing queue's status -- shown for information only, never blocks packing. */
export interface PackingOtherStatusOrderDTO {
  orderNumber: string;
  statusCode: number;
  statusTitle: string;
}

/** Result of opening a customer group: the customer's orders outside "ارسال شده به سرویس پستی" (excluding shipped/cancelled ones, see ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES). */
export interface PackingCustomerOrdersDTO {
  orderNumber: string;
  otherStatusOrders: PackingOtherStatusOrderDTO[];
}

export interface PackingOrderDTO {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  /** How this order ships (Shopfa's `post_method_title`, e.g. Tipax); null when none was selected. */
  shippingMethod: string | null;
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
  /** Orders already packed here whose Shopfa push gave up (FAILED) -- they're hidden from the queue and need a manual retry (see POST /packing/records/:id/retry-sync). */
  failedSyncs: PackingSyncIssueDTO[];
  /** How many packed orders are still waiting for their Shopfa push to go through (retried in the background); they're hidden from the queue meanwhile. */
  pendingSyncCount: number;
  generatedAtISO: string;
}

export interface PackingSyncIssueDTO {
  packingRecordId: string;
  orderNumber: string;
  buyerName: string | null;
  lastSyncError: string | null;
  sentAtISO: string;
}

/**
 * One order of a sent group. The order is packed locally either way;
 * `syncStatus` says whether Shopfa already has it as "ارسال شده" (SYNCED) or
 * whether the push failed and is being retried in the background (PENDING_SYNC).
 */
export interface SendPackedOrderResultDTO {
  orderNumber: string;
  packingRecordId: string;
  photoUrls: string[];
  syncStatus: ShopfaSyncStatus;
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
  /** Null until the Shopfa push went through (see syncStatus). */
  statusCodeAfterSend: number | null;
  statusTitleAfterSend: string | null;
  sentByName: string | null;
  sentAtISO: string;
  /** Confirmation photos of the customer group this order was sent with (oldest first); empty when staff chose "save and continue" without taking any. */
  photoUrls: string[];
  syncStatus: ShopfaSyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface PackingRecordListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

/** "ارسال شده به سرویس پستی" (sent to postal service) -- the only status Packing's queue shows. */
export const PACKING_SOURCE_STATUS_CODE = OrderWorkflowStatus.SENT_TO_POST;

/** "ارسال شده" (shipped) -- where an order lands once every item has been physically packed and confirmed. */
export const PACKING_SENT_STATUS_CODE = OrderWorkflowStatus.SENT;

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
