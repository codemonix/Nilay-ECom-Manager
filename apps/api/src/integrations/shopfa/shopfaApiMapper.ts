import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type {
  ShopfaApiOrder,
  ShopfaApiOrderListResponse,
  ShopfaApiUser,
  ShopfaApiUserListResponse,
} from "./shopfaApiTypes";

/** Shopfa transmits timestamps as unix seconds (see e.g. the `from`/`to` order filters); returns null when missing/unparseable. */
export function toIsoDate(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function toNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
