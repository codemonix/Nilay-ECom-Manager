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
};
