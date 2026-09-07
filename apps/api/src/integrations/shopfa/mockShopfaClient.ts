import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type { ShopfaClient } from "./shopfaTypes";
import { MOCK_CUSTOMERS, MOCK_ORDERS } from "./mockData";
import { mapCustomerToSearchResult, mapCustomerToSummary, mapOrderToSummary } from "./shopfaMapper";

export class MockShopfaClient implements ShopfaClient {
  async getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    return this.getCustomerOrderSummary(externalCustomerId);
  }

  async getCustomerOrderSummary(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    const raw = MOCK_CUSTOMERS.find((c) => c.id === externalCustomerId);
    if (!raw) return null;
    const orders = MOCK_ORDERS.filter((o) => o.customer_id === externalCustomerId);
    return mapCustomerToSummary(raw, orders);
  }

  async getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null> {
    const raw = MOCK_ORDERS.find((o) => o.id === externalOrderId || o.order_number === externalOrderId);
    return raw ? mapOrderToSummary(raw) : null;
  }

  async searchCustomer(query: string): Promise<CustomerSearchResultDTO[]> {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_CUSTOMERS.slice(0, 10).map(mapCustomerToSearchResult);
    return MOCK_CUSTOMERS.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone_number?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    ).map(mapCustomerToSearchResult);
  }

  async searchOrders(query: string): Promise<OrderSummaryDTO[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_ORDERS.filter(
      (o) => o.order_number.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
    ).map(mapOrderToSummary);
  }
}
