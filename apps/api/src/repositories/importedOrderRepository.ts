import type { AnyBulkWriteOperation } from "mongoose";
import {
  ImportedOrderModel,
  type ImportedOrderDocument,
  type ImportedOrderSchemaType,
} from "../models/ImportedOrder";
import { escapeRegex } from "../utils/regex";

export interface UpsertOrderItemData {
  productCode: string;
  sku?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface UpsertOrderBuyerData {
  externalBuyerId: string;
  firstName: string;
  lastName: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  mobile?: string;
  landline?: string;
  nationalId?: string;
}

export interface UpsertOrderData {
  externalOrderId: string;
  status: string;
  purchaseDate: Date | null;
  paymentMethod?: string;
  paymentDate?: string;
  shippingMethod?: string;
  shippingCost: number;
  buyer: UpsertOrderBuyerData;
  cartWeight?: number;
  shipmentCode?: string;
  discountCode?: string;
  discountAmount: number;
  userMessage?: string;
  adminNote?: string;
  purchasePath?: string;
  items: UpsertOrderItemData[];
  itemsTotal: number;
  totalAmount: number;
}

export interface ListImportedOrdersParams {
  page: number;
  pageSize: number;
  search?: string;
}

function buildSearchFilter(search: string): Record<string, unknown> {
  const regex = new RegExp(escapeRegex(search.trim()), "i");
  return {
    $or: [
      { externalOrderId: regex },
      { "buyer.firstName": regex },
      { "buyer.lastName": regex },
      { "buyer.mobile": regex },
      { "buyer.externalBuyerId": regex },
    ],
  };
}

export const importedOrderRepository = {
  /** Upserts by externalOrderId so re-importing an updated export updates existing orders instead of duplicating them. */
  async upsertMany(orders: UpsertOrderData[], importedAt: Date): Promise<void> {
    if (orders.length === 0) return;
    // Mongoose's bulkWrite typings expect $set values shaped like hydrated
    // subdocument arrays (DocumentArray), which plain upsert payloads never
    // are -- this cast is the standard escape hatch for that mismatch.
    const ops = orders.map((order) => ({
      updateOne: {
        filter: { externalOrderId: order.externalOrderId },
        update: { $set: { ...order, importedAt } },
        upsert: true,
      },
    })) as unknown as AnyBulkWriteOperation<ImportedOrderSchemaType>[];
    await ImportedOrderModel.bulkWrite(ops);
  },

  async findByExternalOrderId(externalOrderId: string): Promise<ImportedOrderDocument | null> {
    return ImportedOrderModel.findOne({ externalOrderId });
  },

  async findByBuyerId(externalBuyerId: string): Promise<ImportedOrderDocument[]> {
    return ImportedOrderModel.find({ "buyer.externalBuyerId": externalBuyerId }).sort({ purchaseDate: -1 });
  },

  /** Fallback lookup for guest customers, whose externalBuyerId is only stable per-order (see HttpShopfaClient.getCustomerOrderSummary for the live-API equivalent). */
  async findByBuyerPhone(mobile: string): Promise<ImportedOrderDocument[]> {
    return ImportedOrderModel.find({ "buyer.mobile": mobile }).sort({ purchaseDate: -1 });
  },

  /** Distinct buyers (most recent order's snapshot) matching name/mobile/id, for customer-style autocomplete search. */
  async searchBuyers(
    query: string,
    limit = 10,
  ): Promise<Array<{ externalBuyerId: string; buyer: UpsertOrderBuyerData }>> {
    const q = query.trim();
    if (!q) return [];
    const results = await ImportedOrderModel.aggregate<{ _id: string; buyer: UpsertOrderBuyerData }>([
      { $match: buildSearchFilter(q) },
      { $sort: { purchaseDate: -1 } },
      { $group: { _id: "$buyer.externalBuyerId", buyer: { $first: "$buyer" } } },
      { $limit: limit },
    ]);
    return results.map((r) => ({ externalBuyerId: r._id, buyer: r.buyer }));
  },

  async list(params: ListImportedOrdersParams): Promise<{ items: ImportedOrderDocument[]; total: number }> {
    const filter = params.search ? buildSearchFilter(params.search) : {};
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      ImportedOrderModel.find(filter).sort({ purchaseDate: -1 }).skip(skip).limit(params.pageSize),
      ImportedOrderModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  async count(): Promise<number> {
    return ImportedOrderModel.countDocuments();
  },

  /** Best-effort product lookup by scanning imported order line items -- see ImportedOrdersShopfaClient.getProductByCode. */
  async findItemByProductCode(
    productCode: string,
  ): Promise<{ productCode: string; sku?: string | null; title: string } | null> {
    const order = await ImportedOrderModel.findOne(
      { "items.productCode": productCode },
      { "items.$": 1 },
    );
    return order?.items[0] ?? null;
  },

  /** Best-effort title search across imported order line items, deduped by productCode -- see ImportedOrdersShopfaClient.searchProducts. */
  async searchItemsByTitle(
    query: string,
    limit = 20,
  ): Promise<Array<{ productCode: string; sku?: string | null; title: string }>> {
    const q = query.trim();
    if (!q) return [];
    const regex = new RegExp(escapeRegex(q), "i");
    const results = await ImportedOrderModel.aggregate<{ _id: string; sku?: string | null; title: string }>([
      { $match: { "items.title": regex } },
      { $unwind: "$items" },
      { $match: { "items.title": regex } },
      { $group: { _id: "$items.productCode", sku: { $first: "$items.sku" }, title: { $first: "$items.title" } } },
      { $limit: limit },
    ]);
    return results.map((r) => ({ productCode: r._id, sku: r.sku ?? null, title: r.title }));
  },

  /**
   * Line-item quantity for a product code within a purchase-date range,
   * broken down by order status -- backs
   * ImportedOrdersShopfaClient.getSoldQuantityBreakdown (Development
   * Tools' "total sold quantity" check). Grouped in two stages (per order,
   * then per status) rather than one -- a single order can list the same
   * product code more than once (e.g. two sizes of the same ring bought
   * together), and a one-stage `$group` by status with `orderCount: {
   * $sum: 1 }` would count that one order twice. The two-stage version
   * sums each order's quantity for this product first, then counts
   * distinct orders per status.
   *
   * Unlike HttpShopfaClient.scanOrdersForSoldQuantity, this filters by
   * `purchaseDate` (order-creation date), not payment date: the imported
   * xlsx's "تاریخ پرداخت" column is stored as a raw, unparsed Persian
   * (Jalali) calendar string on `paymentDate` (see ImportedOrder.ts),
   * not a Date, so it can't be range-queried without a calendar
   * conversion this path doesn't do. Only matters when
   * Settings.dataSource is "imported_file" -- the live API path is the
   * one that's payment-date-accurate.
   */
  async getQuantityByStatus(
    productCode: string,
    range: { from: Date; to: Date },
  ): Promise<Array<{ status: string; quantity: number; orderCount: number }>> {
    const results = await ImportedOrderModel.aggregate<{ _id: string; quantity: number; orderCount: number }>([
      { $match: { "items.productCode": productCode, purchaseDate: { $gte: range.from, $lte: range.to } } },
      { $unwind: "$items" },
      { $match: { "items.productCode": productCode } },
      { $group: { _id: { orderId: "$_id", status: "$status" }, quantity: { $sum: "$items.quantity" } } },
      { $group: { _id: "$_id.status", quantity: { $sum: "$quantity" }, orderCount: { $sum: 1 } } },
      { $sort: { quantity: -1 } },
    ]);
    return results.map((r) => ({ status: r._id, quantity: r.quantity, orderCount: r.orderCount }));
  },
};
