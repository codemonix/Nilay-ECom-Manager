/**
 * The order status machine shared by Order Precheck and Packing (see
 * docs/order-status-mchine.md). Every value is the numeric Shopfa status
 * code (see SHOPFA_ORDER_STATUS_OPTIONS for the titles Shopfa reports).
 * "آماده به ارسال" (12) was confirmed live on 2026-09-27 by setting the test
 * order to 12 and reading back its status_title.
 */
export const OrderWorkflowStatus = {
  /** "اعلام پرداخت" -- customer declared payment, not yet confirmed. */
  PAYMENT_DECLARED: 9,
  /** "پرداخت تائيد شده" -- payment confirmed; Order Precheck's default queue. */
  PAYMENT_CONFIRMED: 4,
  /** "پردازش انبار" -- at least one item short, warehouse is sourcing it. */
  WAREHOUSE_PROCESSING: 8,
  /** "تایید حسابداری" -- fully available, waiting to ship together with the customer's other orders. */
  ACCOUNTING_APPROVED: 10,
  /** "آماده به ارسال" -- precheck found the customer's other orders in a combination it can't resolve; needs a manual look in the Shopfa panel. */
  READY_TO_SEND: 12,
  /** "ارسال شده به سرویس پستی" -- handed to Packing (precheck's terminal state). */
  SENT_TO_POST: 13,
  /** "ارسال شده" -- packed and dispatched (Packing's terminal state). */
  SENT: 5,
  /** "کنسل شده" */
  CANCELED: 7,
  /** "حذف شده" */
  DELETED: 0,
  /** "فرم تکميل نشده" -- abandoned checkout. */
  FORM_NOT_COMPLETED: 1,
  /** "فرم تکميل شده" -- checkout form filled, never paid. */
  FORM_COMPLETED: 2,
  /** "تحويل داده شده" -- delivered. */
  DELIVERED: 6,
} as const;
export type OrderWorkflowStatusCode = (typeof OrderWorkflowStatus)[keyof typeof OrderWorkflowStatus];

/**
 * A customer's orders in these statuses are never "sibling" orders for the
 * status machine: they're finished (shipped, delivered), dead (cancelled,
 * deleted) or abandoned checkouts that were never paid. Every other status
 * counts -- including SENT_TO_POST, which the shortage branch of precheck
 * needs to pull back, and which blocks the all-available branch's
 * "everything is in accounting-approved" shortcut. Business rule set by the
 * store owner (2026-09-27); deleted/abandoned orders were added after a live
 * run showed they would otherwise push every repeat customer's order into
 * READY_TO_SEND.
 */
export const ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES: number[] = [
  OrderWorkflowStatus.DELETED,
  OrderWorkflowStatus.FORM_NOT_COMPLETED,
  OrderWorkflowStatus.FORM_COMPLETED,
  OrderWorkflowStatus.SENT,
  OrderWorkflowStatus.DELIVERED,
  OrderWorkflowStatus.CANCELED,
];

/** Statuses that mean "this customer still has an order that isn't ready yet" in precheck's all-available branch. */
export const ORDER_WORKFLOW_NOT_READY_STATUS_CODES: number[] = [
  OrderWorkflowStatus.PAYMENT_CONFIRMED,
  OrderWorkflowStatus.WAREHOUSE_PROCESSING,
  OrderWorkflowStatus.PAYMENT_DECLARED,
];

/** Where a status change was made from, for the local audit log. */
export enum OrderStatusChangeSource {
  PRECHECK = "precheck",
  PACKING = "packing",
}

/**
 * State of pushing a local change to Shopfa. A failed push stays
 * PENDING_SYNC and is retried in the background; only after the retry budget
 * runs out does it become FAILED (and needs a manual retry).
 */
export enum ShopfaSyncStatus {
  PENDING_SYNC = "pending_sync",
  SYNCED = "synced",
  FAILED = "failed",
}

/** One status change this system applied to a Shopfa order. */
export interface OrderStatusChangeDTO {
  orderNumber: string;
  fromStatusCode: number | null;
  toStatusCode: number;
  toStatusTitle: string;
  source: OrderStatusChangeSource;
  changedByName: string | null;
  changedAtISO: string;
}

/** A packing pass of the order, with its locally kept pictures and whether its Shopfa push went through. */
export interface OrderHistoryPackingDTO {
  packingRecordId: string;
  sentAtISO: string;
  sentByName: string | null;
  photoUrls: string[];
  syncStatus: ShopfaSyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface OrderHistoryDTO {
  orderNumber: string;
  /** Oldest first. */
  statusChanges: OrderStatusChangeDTO[];
  /** Newest first. */
  packings: OrderHistoryPackingDTO[];
}
