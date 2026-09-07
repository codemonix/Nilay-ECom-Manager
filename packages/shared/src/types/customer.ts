/** Data owned by Shopfa, surfaced read-only through our backend integration layer. */
export interface CustomerSummaryDTO {
  externalCustomerId: string;
  name: string;
  phone?: string;
  email?: string;
  ordersCount: number;
  totalSpent: number;
  currency: string;
  averageOrderValue: number;
  lastOrderDate: string | null;
}

export interface CustomerSearchResultDTO {
  externalCustomerId: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface OrderSummaryDTO {
  externalOrderId: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  total: number;
  currency: string;
  items: Array<{
    externalItemId: string;
    sku: string;
    title: string;
    quantity: number;
  }>;
}
