import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type {
  ShopfaApiOrder,
  ShopfaApiOrderListResponse,
  ShopfaApiProduct,
  ShopfaApiProductListResponse,
  ShopfaApiUser,
  ShopfaApiUserListResponse,
} from "./shopfaApiTypes";
import type {
  ShopfaPackingOrder,
  ShopfaPrecheckOrder,
  ShopfaProductLookup,
  ShopfaShortageReportOrder,
} from "./shopfaTypes";

/** Shopfa transmits timestamps as unix seconds (see e.g. the `from`/`to` order filters); returns null when missing/unparseable. */
export function toIsoDate(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Same parsing as toIsoDate, as a Date instead of a string -- for callers that still need to compare/sort dates rather than just display them. */
function toDateOrNull(value: string | number | undefined | null): Date | null {
  const iso = toIsoDate(value);
  return iso ? new Date(iso) : null;
}

function toNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Unlike toNumber, distinguishes "field absent" (null, unknown) from a genuine 0. */
function toNullableNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** POST /api/user/users wraps rows as `{ items: [...] }`; tolerate a bare array too. */
export function readUserItems(data: ShopfaApiUser[] | ShopfaApiUserListResponse | undefined | null): ShopfaApiUser[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

/** POST /api/shop/orders and /api/shop/orders/details both wrap rows as `{ baskets: [...] }`; tolerate a bare array too. */
export function readOrderBaskets(
  data: ShopfaApiOrder[] | ShopfaApiOrderListResponse | undefined | null,
): ShopfaApiOrder[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.baskets ?? [];
}

function customerName(order: Pick<ShopfaApiOrder, "name" | "family">): string {
  return [order.name, order.family].filter(Boolean).join(" ").trim();
}

/** Shopfa uses `0` as a "none" sentinel for both `user_id` (guest checkout) and `variant_id` (no variant) rather than omitting the field. */
function isZero(value: string | number | undefined): boolean {
  return value === undefined || Number(value) === 0;
}

/** /api/shop/orders/details is the same list endpoint as /api/shop/orders filtered by `id`, so it returns `{ baskets: [order] }`, not the order itself. */
export function extractOrderDetails(data: ShopfaApiOrderListResponse | undefined | null): ShopfaApiOrder | null {
  return readOrderBaskets(data)[0] ?? null;
}

export function mapApiOrderToSummary(raw: ShopfaApiOrder): OrderSummaryDTO {
  return {
    externalOrderId: String(raw.id),
    orderNumber: raw.session !== undefined && raw.session !== "" ? String(raw.session) : String(raw.id),
    createdAt: toIsoDate(raw.date) ?? new Date(0).toISOString(),
    status: raw.status_title ?? String(raw.status),
    total: toNumber(raw.sum_price ?? raw.item_price),
    currency: "IRR",
    items: (raw.items ?? []).map((item) => ({
      externalItemId: String(isZero(item.variant_id) ? item.product_id : item.variant_id),
      sku: String(item.product_id),
      title: [item.title, item.variant_title].filter(Boolean).join(" - "),
      quantity: toNumber(item.count) || 1,
    })),
    externalCustomerId: isZero(raw.user_id) ? undefined : String(raw.user_id),
    customerName: customerName(raw) || undefined,
    customerPhone: raw.mobile || undefined,
    customerEmail: raw.email || undefined,
  };
}

/** POST /api/shop/product/list wraps rows as `{ items: [...] }`; tolerate a bare array too. */
export function readProductItems(
  data: ShopfaApiProduct[] | ShopfaApiProductListResponse | undefined | null,
): ShopfaApiProduct[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

/** `id` doubles as both Shopfa's product id and our `productCode` (the "کد کالا" xlsx column) -- there is no separate SKU field in this response. */
export function mapApiProductToLookup(raw: ShopfaApiProduct): ShopfaProductLookup {
  return {
    shopfaProductId: String(raw.id),
    productCode: String(raw.id),
    title: raw.title ?? "",
    sku: null,
    price: toNumber(raw.price),
    imageUrl: raw.thumb ?? null,
    availableQuantity: toNullableNumber(raw.quantity),
  };
}

export function mapApiUserToSearchResult(raw: ShopfaApiUser): CustomerSearchResultDTO {
  return {
    externalCustomerId: String(raw.id),
    name: raw.nickname || [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim() || raw.name || String(raw.id),
    phone: raw.mobile,
    email: raw.email ?? undefined,
  };
}

/**
 * Shopfa has no single "customer summary" endpoint, so a customer's summary
 * is derived by aggregating their orders (POST /api/shop/orders filtered by
 * user_id) -- name/phone/email come from that customer's most recent order,
 * since /api/user/users does not support looking a user up by id.
 */
/** For Reporting's shortage report -- see ShopfaClient.listOrdersByStatusForShortageReport. */
export function mapApiOrderToShortageReportOrder(raw: ShopfaApiOrder): ShopfaShortageReportOrder {
  return {
    externalOrderId: String(raw.id),
    orderNumber: raw.session !== undefined && raw.session !== "" ? String(raw.session) : String(raw.id),
    note: raw.note ?? "",
    paymentDate: toDateOrNull(raw.payment_date),
    createdDate: toDateOrNull(raw.date),
    items: (raw.items ?? []).map((item) => ({
      productId: String(item.product_id),
      variantId: isZero(item.variant_id) ? null : String(item.variant_id),
      title: [item.title, item.variant_title].filter(Boolean).join(" - "),
      imageUrl: item.thumb ?? null,
      quantity: toNumber(item.count) || 1,
    })),
  };
}

/**
 * For Order Precheck's queue -- see ShopfaClient.listOrdersByStatusForPrecheck.
 * `statusCode` is the loop variable the caller already filtered this basket
 * by (same approach as listOrdersByStatusForShortageReport's per-code loop),
 * used in preference to parsing `raw.status` since Shopfa's status filter
 * only ever returns baskets matching exactly the code requested.
 */
export function mapApiOrderToPrecheckOrder(raw: ShopfaApiOrder, statusCode: number): ShopfaPrecheckOrder {
  return {
    externalOrderId: String(raw.id),
    orderNumber: raw.session !== undefined && raw.session !== "" ? String(raw.session) : String(raw.id),
    buyerName: customerName(raw) || null,
    orderDate: toDateOrNull(raw.date),
    note: raw.note ?? "",
    statusCode,
    statusTitle: raw.status_title ?? String(raw.status),
    items: (raw.items ?? []).map((item) => ({
      productCode: String(item.product_id),
      title: [item.title, item.variant_title].filter(Boolean).join(" - "),
      imageUrl: item.thumb ?? null,
      quantity: toNumber(item.count) || 1,
    })),
  };
}

/** For Packing's queue -- see ShopfaClient.listOrdersByStatusForPacking. Same shape as mapApiOrderToPrecheckOrder minus the admin note, which Packing never touches. */
export function mapApiOrderToPackingOrder(raw: ShopfaApiOrder, statusCode: number): ShopfaPackingOrder {
  return {
    externalOrderId: String(raw.id),
    orderNumber: raw.session !== undefined && raw.session !== "" ? String(raw.session) : String(raw.id),
    buyerName: customerName(raw) || null,
    orderDate: toDateOrNull(raw.date),
    statusCode,
    statusTitle: raw.status_title ?? String(raw.status),
    items: (raw.items ?? []).map((item) => ({
      productCode: String(item.product_id),
      title: [item.title, item.variant_title].filter(Boolean).join(" - "),
      imageUrl: item.thumb ?? null,
      quantity: toNumber(item.count) || 1,
    })),
  };
}

export function summarizeCustomerOrders(
  externalCustomerId: string,
  orders: ShopfaApiOrder[],
): CustomerSummaryDTO | null {
  if (orders.length === 0) return null;
  const sorted = [...orders].sort((a, b) => toNumber(b.date) - toNumber(a.date));
  const latest = sorted[0]!;
  const totalSpent = orders.reduce((sum, order) => sum + toNumber(order.sum_price ?? order.item_price), 0);
  return {
    externalCustomerId,
    name: customerName(latest) || externalCustomerId,
    phone: latest.mobile || undefined,
    email: latest.email || undefined,
    ordersCount: orders.length,
    totalSpent,
    currency: "IRR",
    averageOrderValue: Math.round(totalSpent / orders.length),
    lastOrderDate: toIsoDate(latest.date),
  };
}
