import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";

/**
 * Abstraction over the external Shopfa e-commerce platform, which is the
 * source of truth for customers, orders, and products. Nothing outside of
 * this integrations/shopfa directory should know whether data is coming
 * from the real Shopfa HTTP API or the local mock provider -- consumers
 * (customerService) depend only on this interface (dependency inversion).
 */
export interface ShopfaClient {
  getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null>;
  getCustomerOrderSummary(externalCustomerId: string): Promise<CustomerSummaryDTO | null>;
  getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null>;
  searchCustomer(query: string): Promise<CustomerSearchResultDTO[]>;
  searchOrders(query: string): Promise<OrderSummaryDTO[]>;
}

/** Raw shapes as returned by the real Shopfa REST API (subject to Shopfa's own conventions). */
export interface ShopfaRawCustomer {
  id: string;
  full_name: string;
  phone_number?: string;
  email?: string;
  orders_count: number;
  total_spent: string;
  currency: string;
  last_order_at: string | null;
}

export interface ShopfaRawOrderItem {
  item_id: string;
  sku: string;
  title: string;
  quantity: number;
}

export interface ShopfaRawOrder {
  id: string;
  order_number: string;
  customer_id: string;
  created_at: string;
  status: string;
  total: string;
  currency: string;
  items: ShopfaRawOrderItem[];
}
