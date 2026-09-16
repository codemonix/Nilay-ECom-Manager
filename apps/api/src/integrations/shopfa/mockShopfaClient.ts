import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type {
  ShopfaClient,
  ShopfaDateRange,
  ShopfaOrderAdminNote,
  ShopfaOrderDateWindow,
  ShopfaOrderPrecheckUpdate,
  ShopfaOrderPrecheckUpdateResult,
  ShopfaOrderStatusUpdateResult,
  ShopfaPackingOrder,
  ShopfaPrecheckOrder,
  ShopfaProductLookup,
  ShopfaShortageReportOrder,
  ShopfaSoldQuantityResult,
} from "./shopfaTypes";
import { ApiError } from "../../utils/ApiError";
import { MOCK_CUSTOMERS, MOCK_ORDERS, MOCK_PRODUCT_CODES } from "./mockData";
import { mapCustomerToSearchResult, mapCustomerToSummary, mapOrderToSummary } from "./shopfaMapper";

export class MockShopfaClient implements ShopfaClient {
  async getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    return this.getCustomerOrderSummary(externalCustomerId);
  }

  async getCustomerOrderSummary(externalCustomerId: string, _phone?: string): Promise<CustomerSummaryDTO | null> {
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

  async getProductByCode(code: string): Promise<ShopfaProductLookup | null> {
    const q = code.trim().toLowerCase();
    const product = MOCK_PRODUCT_CODES.find((p) => p.code.toLowerCase() === q);
    return product ? mapMockProductToLookup(product) : null;
  }

  async searchProducts(query: string): Promise<ShopfaProductLookup[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_PRODUCT_CODES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    ).map(mapMockProductToLookup);
  }

  /** MOCK_ORDERS' items reference a product by `sku`, not `code` -- resolved via MOCK_PRODUCT_CODES so this matches the same productCode values getProductByCode/searchProducts return. No caching -- the fixture array is already in memory, so every call is fresh. */
  async getSoldQuantityBreakdown(productCode: string, range: ShopfaDateRange): Promise<ShopfaSoldQuantityResult> {
    const product = MOCK_PRODUCT_CODES.find((p) => p.code === productCode);
    if (!product) return { rows: [], fetchedAt: new Date(), servedFromCache: false };
    const byStatus = new Map<string, { quantity: number; orderCount: number }>();
    for (const order of MOCK_ORDERS) {
      const createdAt = new Date(order.created_at);
      if (createdAt < range.from || createdAt > range.to) continue;
      const matching = order.items.filter((item) => item.sku === product.sku);
      if (matching.length === 0) continue;
      const quantity = matching.reduce((sum, item) => sum + item.quantity, 0);
      const entry = byStatus.get(order.status) ?? { quantity: 0, orderCount: 0 };
      entry.quantity += quantity;
      entry.orderCount += 1;
      byStatus.set(order.status, entry);
    }
    const rows = Array.from(byStatus.entries()).map(([status, { quantity, orderCount }]) => ({
      status,
      quantity,
      orderCount,
    }));
    return { rows, fetchedAt: new Date(), servedFromCache: false };
  }

  /** Mutates the in-memory fixture directly -- no live write to verify since this can't silently fail. */
  async updateProductTitle(productCode: string, title: string): Promise<ShopfaProductLookup | null> {
    const product = MOCK_PRODUCT_CODES.find((p) => p.code === productCode);
    if (!product) return null;
    product.title = title;
    return mapMockProductToLookup(product);
  }

  async getOrderAdminNote(orderNumber: string): Promise<ShopfaOrderAdminNote | null> {
    const raw = MOCK_ORDERS.find((o) => o.id === orderNumber || o.order_number === orderNumber);
    return raw ? { externalOrderId: raw.id, orderNumber: raw.order_number, note: raw.note ?? "" } : null;
  }

  /** Mutates the in-memory fixture directly, same as updateProductTitle above. */
  async updateOrderAdminNote(orderNumber: string, note: string): Promise<ShopfaOrderAdminNote | null> {
    const raw = MOCK_ORDERS.find((o) => o.id === orderNumber || o.order_number === orderNumber);
    if (!raw) return null;
    raw.note = note;
    return { externalOrderId: raw.id, orderNumber: raw.order_number, note };
  }

  /** Mock orders don't share Shopfa's numeric status codes (see ShopfaClient.listOrdersByStatusForShortageReport) -- there's nothing meaningful to filter here. */
  async listOrdersByStatusForShortageReport(
    _statusCodes: number[],
    _range: ShopfaOrderDateWindow,
  ): Promise<ShopfaShortageReportOrder[]> {
    throw ApiError.badRequest(
      "The shortage report requires the Live API data source -- mock/imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForShortageReport above -- mock orders have no Shopfa numeric status codes to filter by. */
  async listOrdersByStatusForPrecheck(_statusCodes: number[]): Promise<ShopfaPrecheckOrder[]> {
    throw ApiError.badRequest(
      "Order Precheck requires the Live API data source -- mock/imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPrecheck above. */
  async updateOrderNoteAndStatus(
    _orderNumber: string,
    _update: ShopfaOrderPrecheckUpdate,
  ): Promise<ShopfaOrderPrecheckUpdateResult | null> {
    throw ApiError.badRequest(
      "Order Precheck requires the Live API data source -- mock/imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPrecheck above -- mock orders have no Shopfa numeric status codes to filter by. */
  async listOrdersByStatusForPacking(
    _statusCode: number,
    _range: ShopfaOrderDateWindow,
  ): Promise<ShopfaPackingOrder[]> {
    throw ApiError.badRequest(
      "Packing requires the Live API data source -- mock/imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPacking above. */
  async updateOrderStatus(_orderNumber: string, _statusCode: number): Promise<ShopfaOrderStatusUpdateResult | null> {
    throw ApiError.badRequest(
      "Packing requires the Live API data source -- mock/imported order data has no Shopfa status codes to filter by.",
    );
  }
}

function mapMockProductToLookup(product: (typeof MOCK_PRODUCT_CODES)[number]): ShopfaProductLookup {
  return {
    shopfaProductId: product.shopfaProductId,
    productCode: product.code,
    title: product.title,
    sku: product.sku,
    price: product.price,
    availableQuantity: product.availableQuantity,
  };
}
