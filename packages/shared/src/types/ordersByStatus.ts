/**
 * "Status Check" (بررسی وضعیت): a read-only overview of live Shopfa orders in
 * any chosen statuses, so staff can see what is going on RIGHT NOW -- e.g.
 * everything currently in "پردازش انبار" or "تایید حسابداری", newest activity
 * first -- without opening Precheck or Packing. Its time window is on the
 * order's LAST-UPDATED date (unlike Precheck/Packing), since the question it
 * answers is "what changed recently". Orders sent from Packing also carry
 * their final packing pictures. Live-API only, like those.
 */
export interface StatusOrderDTO {
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  orderDateISO: string | null;
  paymentDateISO: string | null;
  /** When the order was last modified on Shopfa (any change, e.g. a status change) -- what this page's window and ordering are based on. */
  updatedAtISO: string | null;
  statusCode: number;
  statusTitle: string;
  shippingMethod: string | null;
  itemCount: number;
  totalQuantity: number;
  /** Final pictures taken in Packing when this order was sent (oldest first; from the most recent packing record that has any). Empty for orders that never went through Packing or were sent without a picture. Paths are relative to the API origin. */
  packingPhotoUrls: string[];
}

export interface StatusOrderCountDTO {
  statusCode: number;
  statusTitle: string;
  /** Orders of this status included in this result (i.e. inside the time window). */
  count: number;
  /** Every order currently in this status on Shopfa regardless of the window; null if it couldn't be read. When larger than `count`, the window is hiding some. */
  totalInStatus: number | null;
}

export interface OrdersByStatusResultDTO {
  statusCodes: number[];
  days: OrdersByStatusRangeDays;
  /** The exact window the server resolved `days` into (by LAST-UPDATED date), or null for "all time". */
  rangeFromISO: string | null;
  rangeToISO: string | null;
  orders: StatusOrderDTO[];
  countsByStatus: StatusOrderCountDTO[];
  generatedAtISO: string;
}

/** `0` = ALL TIME (no window). Days count back from now on the order's last-updated date. */
export const ORDERS_BY_STATUS_RANGE_DAYS_VALUES = [0, 1, 7, 30, 60, 180] as const;
export type OrdersByStatusRangeDays = (typeof ORDERS_BY_STATUS_RANGE_DAYS_VALUES)[number];
/** A week: this page is for seeing recent activity; staff widen it (or pick All time) when they need to. */
export const DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS: OrdersByStatusRangeDays = 7;
