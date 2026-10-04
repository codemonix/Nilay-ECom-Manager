import type { CaseCategory, CasePriority, CaseStatus } from "../constants/caseEnums";
import type { OrderHistoryPackingDTO, OrderStatusChangeDTO } from "./orderWorkflow";
import { ORDERS_BY_STATUS_RANGE_DAYS_VALUES, type OrdersByStatusRangeDays } from "./ordersByStatus";

/**
 * Reporting's "Order History" report: live Shopfa orders found either by
 * their current status or by a search (phone number, order number or
 * customer name), each with everything this system recorded about it -- the
 * status changes it made, the order's packing passes with their pictures,
 * and the cases linked to it. Live-API only, like the Status Check page it
 * shares its order scan with.
 */
export interface OrderHistoryCaseDTO {
  id: string;
  caseNumber: string;
  subject: string;
  status: CaseStatus;
  priority: CasePriority;
  category: CaseCategory;
  createdAtISO: string;
  /** Image attachments of the case, oldest first. Paths are relative to the API origin. */
  photoUrls: string[];
}

export interface OrderHistoryReportOrderDTO {
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  orderDateISO: string | null;
  paymentDateISO: string | null;
  /** When the order was last modified on Shopfa -- what the by-status time frame and the ordering are based on. */
  updatedAtISO: string | null;
  statusCode: number;
  statusTitle: string;
  shippingMethod: string | null;
  itemCount: number;
  totalQuantity: number;
  /** Status changes this system made (Order Precheck and Packing), oldest first. Changes made anywhere else (e.g. the Shopfa panel) only appear in Shopfa's own activity log -- see OrderActivityDTO. */
  statusChanges: OrderStatusChangeDTO[];
  /** Packing passes with their pictures, newest first. */
  packings: OrderHistoryPackingDTO[];
  /** Cases linked to this order, newest first. */
  cases: OrderHistoryCaseDTO[];
}

/**
 * One entry of Shopfa's own activity log for an order -- what the Shopfa
 * panel shows under "نمایش فعالیت ها": creation, items added or removed,
 * payment attempts, shipping method and every status change, whoever made
 * it (customer, panel staff or this system).
 */
export interface OrderActivityDTO {
  id: string;
  /** Shopfa's own description of the event, in Persian, as the panel shows it. */
  event: string;
  /** The status the order was put in, when this entry is a status change; null otherwise. */
  statusTitle: string | null;
  atISO: string | null;
  /** Who did it, as Shopfa reports it ("سیستم" for automatic events); null when unknown. */
  actorName: string | null;
}

export interface OrderActivitiesDTO {
  orderNumber: string;
  /** Oldest first. */
  activities: OrderActivityDTO[];
  /** True when the order has more activity than was fetched (the most recent entries are kept). */
  truncated: boolean;
}

export interface OrderHistoryReportResultDTO {
  /** Set when the report was run by status; null for a search. */
  statusCode: number | null;
  days: OrderHistoryReportRangeDays | null;
  /** The window `days` resolved into (by LAST-UPDATED date); null for "all time" and for searches. */
  rangeFromISO: string | null;
  rangeToISO: string | null;
  /** The normalized search text; null when the report was run by status. */
  query: string | null;
  /** Most recently updated first. */
  orders: OrderHistoryReportOrderDTO[];
  /** True when a search matched more orders than were fetched (only the most recent ones are included). */
  truncated: boolean;
  generatedAtISO: string;
}

/** Same last-updated windows as Status Check (`0` = all time). */
export const ORDER_HISTORY_REPORT_RANGE_DAYS_VALUES = ORDERS_BY_STATUS_RANGE_DAYS_VALUES;
export type OrderHistoryReportRangeDays = OrdersByStatusRangeDays;
/** A month: wide enough to follow an order through precheck, packing and a later complaint. */
export const DEFAULT_ORDER_HISTORY_REPORT_RANGE_DAYS: OrderHistoryReportRangeDays = 30;
/** Shortest search text the report accepts. */
export const ORDER_HISTORY_REPORT_MIN_QUERY_LENGTH = 3;
