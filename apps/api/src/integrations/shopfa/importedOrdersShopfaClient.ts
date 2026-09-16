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
import { importedOrderRepository } from "../../repositories/importedOrderRepository";
import type { ImportedOrderDocument } from "../../models/ImportedOrder";
import { ApiError } from "../../utils/ApiError";

function buyerName(buyer: {
  firstName?: string | null;
  lastName?: string | null;
  externalBuyerId: string;
}): string {
  return [buyer.firstName, buyer.lastName].filter(Boolean).join(" ").trim() || buyer.externalBuyerId;
}

function mapOrderDoc(doc: ImportedOrderDocument): OrderSummaryDTO {
  return {
    externalOrderId: doc.externalOrderId,
    orderNumber: doc.externalOrderId,
    createdAt: (doc.purchaseDate ?? doc.importedAt).toISOString(),
    status: doc.status,
    total: doc.totalAmount,
    currency: "IRR",
    items: doc.items.map((item) => ({
      externalItemId: item.productCode,
      sku: item.sku || item.productCode,
      title: item.title,
      quantity: item.quantity,
    })),
    externalCustomerId: doc.buyer.externalBuyerId,
    customerName: buyerName(doc.buyer),
    customerPhone: doc.buyer.mobile ?? undefined,
  };
}

/**
 * ShopfaClient backed by orders imported from an xlsx export, standing in
 * for the real Shopfa HTTP API until live API credentials are available.
 * Selected at runtime by the factory in ./index.ts based on
 * Settings.dataSource -- see docs/architecture.md#shopfa-integration.
 */
export class ImportedOrdersShopfaClient implements ShopfaClient {
  async getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    return this.getCustomerOrderSummary(externalCustomerId);
  }

  async getCustomerOrderSummary(externalCustomerId: string, phone?: string): Promise<CustomerSummaryDTO | null> {
    let orders = await importedOrderRepository.findByBuyerId(externalCustomerId);
    if (orders.length === 0 && phone) {
      orders = await importedOrderRepository.findByBuyerPhone(phone);
    }
    if (orders.length === 0) return null;
    const latest = orders[0]!;
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    return {
      externalCustomerId,
      name: buyerName(latest.buyer),
      phone: latest.buyer.mobile ?? undefined,
      ordersCount: orders.length,
      totalSpent,
      currency: "IRR",
      averageOrderValue: Math.round(totalSpent / orders.length),
      lastOrderDate: (latest.purchaseDate ?? latest.importedAt).toISOString(),
    };
  }

  async getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null> {
    const order = await importedOrderRepository.findByExternalOrderId(externalOrderId);
    return order ? mapOrderDoc(order) : null;
  }

  async searchCustomer(query: string): Promise<CustomerSearchResultDTO[]> {
    const buyers = await importedOrderRepository.searchBuyers(query);
    return buyers.map(({ externalBuyerId, buyer }) => ({
      externalCustomerId: externalBuyerId,
      name: buyerName(buyer),
      phone: buyer.mobile,
    }));
  }

  async searchOrders(query: string): Promise<OrderSummaryDTO[]> {
    const q = query.trim();
    if (!q) return [];
    const { items } = await importedOrderRepository.list({ page: 1, pageSize: 20, search: q });
    return items.map(mapOrderDoc);
  }

  /**
   * Best-effort: there is no product catalog in imported xlsx data, only
   * order line items, so this scans those for a matching productCode and
   * synthesizes a lookup from it. No canonical price is available this way
   * (unlike the real Shopfa API or the mock fixture), so `price` is 0 --
   * callers should treat it as informational only in this data source.
   */
  async getProductByCode(code: string): Promise<ShopfaProductLookup | null> {
    const item = await importedOrderRepository.findItemByProductCode(code);
    if (!item) return null;
    return {
      shopfaProductId: item.productCode,
      productCode: item.productCode,
      title: item.title,
      sku: item.sku ?? null,
      price: 0,
      // Imported orders are past sales, not a current stock feed -- no
      // available-quantity data exists in this data source.
      availableQuantity: null,
    };
  }

  /** Best-effort: searches past order line-item titles, since there's no product catalog in imported xlsx data. Same price/quantity limitations as getProductByCode above. */
  async searchProducts(query: string): Promise<ShopfaProductLookup[]> {
    const items = await importedOrderRepository.searchItemsByTitle(query);
    return items.map((item) => ({
      shopfaProductId: item.productCode,
      productCode: item.productCode,
      title: item.title,
      sku: item.sku ?? null,
      price: 0,
      availableQuantity: null,
    }));
  }

  /** No caching here -- unlike HttpShopfaClient's live order scan, this is a single indexed Mongo aggregation and already fast, so every call is treated as fresh. */
  async getSoldQuantityBreakdown(productCode: string, range: ShopfaDateRange): Promise<ShopfaSoldQuantityResult> {
    const rows = await importedOrderRepository.getQuantityByStatus(productCode, range);
    return { rows, fetchedAt: new Date(), servedFromCache: false };
  }

  /** There's no live product catalog to write to in this data source -- only past order line items (see getProductByCode above). */
  async updateProductTitle(_productCode: string, _title: string): Promise<ShopfaProductLookup | null> {
    throw ApiError.badRequest(
      "Updating a product title requires the Live API data source -- imported order data has no product catalog to update.",
    );
  }

  /** Imported xlsx orders carry no admin-note field at all -- there's no Shopfa dashboard behind this data source to read one from. */
  async getOrderAdminNote(_orderNumber: string): Promise<ShopfaOrderAdminNote | null> {
    throw ApiError.badRequest(
      "Reading an order's admin note requires the Live API data source -- imported order data has no admin note field.",
    );
  }

  /** See getOrderAdminNote above -- same reason writing isn't possible either. */
  async updateOrderAdminNote(_orderNumber: string, _note: string): Promise<ShopfaOrderAdminNote | null> {
    throw ApiError.badRequest(
      "Updating an order's admin note requires the Live API data source -- imported order data has no admin note field.",
    );
  }

  /** Imported xlsx orders don't share Shopfa's numeric status codes or have an admin-note field -- see getOrderAdminNote above for the same reasoning. */
  async listOrdersByStatusForShortageReport(
    _statusCodes: number[],
    _range: ShopfaOrderDateWindow,
  ): Promise<ShopfaShortageReportOrder[]> {
    throw ApiError.badRequest(
      "The shortage report requires the Live API data source -- imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForShortageReport above -- imported order data has no Shopfa numeric status codes to filter by. */
  async listOrdersByStatusForPrecheck(_statusCodes: number[]): Promise<ShopfaPrecheckOrder[]> {
    throw ApiError.badRequest(
      "Order Precheck requires the Live API data source -- imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPrecheck above. */
  async updateOrderNoteAndStatus(
    _orderNumber: string,
    _update: ShopfaOrderPrecheckUpdate,
  ): Promise<ShopfaOrderPrecheckUpdateResult | null> {
    throw ApiError.badRequest(
      "Order Precheck requires the Live API data source -- imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPrecheck above -- imported order data has no Shopfa numeric status codes to filter by. */
  async listOrdersByStatusForPacking(
    _statusCode: number,
    _range: ShopfaOrderDateWindow,
  ): Promise<ShopfaPackingOrder[]> {
    throw ApiError.badRequest(
      "Packing requires the Live API data source -- imported order data has no Shopfa status codes to filter by.",
    );
  }

  /** Same reasoning as listOrdersByStatusForPacking above. */
  async updateOrderStatus(_orderNumber: string, _statusCode: number): Promise<ShopfaOrderStatusUpdateResult | null> {
    throw ApiError.badRequest(
      "Packing requires the Live API data source -- imported order data has no Shopfa status codes to filter by.",
    );
  }
}
