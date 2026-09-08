import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type { ShopfaClient } from "./shopfaTypes";
import { importedOrderRepository } from "../../repositories/importedOrderRepository";
import type { ImportedOrderDocument } from "../../models/ImportedOrder";

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
}
