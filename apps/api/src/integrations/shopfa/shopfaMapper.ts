import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type { ShopfaRawCustomer, ShopfaRawOrder } from "./shopfaTypes";

export function mapCustomerToSummary(
  raw: ShopfaRawCustomer,
  ordersForCustomer: ShopfaRawOrder[],
): CustomerSummaryDTO {
  const totalSpent = Number(raw.total_spent);
  const ordersCount = raw.orders_count;
  return {
    externalCustomerId: raw.id,
    name: raw.full_name,
    phone: raw.phone_number,
    email: raw.email,
    ordersCount,
    totalSpent,
    currency: raw.currency,
    averageOrderValue: ordersCount > 0 ? Math.round(totalSpent / ordersCount) : 0,
    lastOrderDate:
      raw.last_order_at ??
      ordersForCustomer.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at ??
      null,
  };
}

export function mapCustomerToSearchResult(raw: ShopfaRawCustomer): CustomerSearchResultDTO {
  return {
    externalCustomerId: raw.id,
    name: raw.full_name,
    phone: raw.phone_number,
    email: raw.email,
  };
}

export function mapOrderToSummary(raw: ShopfaRawOrder): OrderSummaryDTO {
  return {
    externalOrderId: raw.id,
    orderNumber: raw.order_number,
    createdAt: raw.created_at,
    status: raw.status,
    total: Number(raw.total),
    currency: raw.currency,
    items: raw.items.map((i) => ({
      externalItemId: i.item_id,
      sku: i.sku,
      title: i.title,
      quantity: i.quantity,
    })),
  };
}
