import type { OrderStatusChangeSource, ShopfaSyncStatus } from "./orderWorkflow";

/**
 * Reporting's "Order Activity Log" report: who did what to which order, as
 * one newest-first feed over everything this system records when staff work
 * an order -- the status changes made from Order Precheck and Packing, the
 * packing sends and the pictures uploaded with them. Unlike the Order
 * History report it starts from the actions (a period, optionally one user
 * or one order) rather than from the orders, and it reads only local data,
 * so it works with any data source. Changes made outside this system (e.g.
 * in the Shopfa panel) are not part of it.
 */
export enum OrderAuditEventType {
  STATUS_CHANGED = "status_changed",
  ORDER_PACKED = "order_packed",
  PHOTOS_UPLOADED = "photos_uploaded",
}
export const ORDER_AUDIT_EVENT_TYPE_VALUES = Object.values(OrderAuditEventType);

interface OrderAuditEventBase {
  /** Unique within the report (the type plus the underlying record's id). */
  id: string;
  atISO: string;
  orderNumber: string;
  /** Null for actions with no known user (e.g. records from before the actor was stored). */
  actorId: string | null;
  actorName: string | null;
}

export interface OrderAuditStatusChangedEventDTO extends OrderAuditEventBase {
  type: OrderAuditEventType.STATUS_CHANGED;
  /** Null when the status before the change wasn't known. */
  fromStatusCode: number | null;
  fromStatusTitle: string | null;
  toStatusCode: number;
  toStatusTitle: string;
  source: OrderStatusChangeSource;
}

export interface OrderAuditOrderPackedEventDTO extends OrderAuditEventBase {
  type: OrderAuditEventType.ORDER_PACKED;
  buyerName: string | null;
  /** Whether the "sent" status reached Shopfa; the status change itself is its own event once it did. */
  syncStatus: ShopfaSyncStatus;
}

/** The pictures one user uploaded for one packing send of the order. */
export interface OrderAuditPhotosUploadedEventDTO extends OrderAuditEventBase {
  type: OrderAuditEventType.PHOTOS_UPLOADED;
  /** Oldest first. Paths are relative to the API origin. */
  photoUrls: string[];
}

export type OrderAuditEventDTO =
  | OrderAuditStatusChangedEventDTO
  | OrderAuditOrderPackedEventDTO
  | OrderAuditPhotosUploadedEventDTO;

/** One user's totals over the whole filtered period (not just the page shown). */
export interface OrderAuditUserSummaryDTO {
  actorId: string | null;
  actorName: string | null;
  statusChanges: number;
  ordersPacked: number;
  /** Number of pictures, not of uploads. */
  photosUploaded: number;
}

export interface OrderAuditReportResultDTO {
  rangeFromISO: string;
  rangeToISO: string;
  page: number;
  pageSize: number;
  /** Events matching the filters, across all pages. */
  total: number;
  /** Newest first. */
  events: OrderAuditEventDTO[];
  /** Most active user first. */
  summary: OrderAuditUserSummaryDTO[];
  generatedAtISO: string;
}

export const ORDER_AUDIT_REPORT_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_ORDER_AUDIT_REPORT_PAGE_SIZE = 50;
