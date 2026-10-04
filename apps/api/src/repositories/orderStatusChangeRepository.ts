import type { OrderStatusChangeSource } from "@complaint-system/shared";
import { OrderStatusChangeModel, type OrderStatusChangeDocument } from "../models/OrderStatusChange";

export interface CreateOrderStatusChangeData {
  orderNumber: string;
  fromStatusCode: number | null;
  toStatusCode: number;
  toStatusTitle: string;
  source: OrderStatusChangeSource;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: Date;
}

export const orderStatusChangeRepository = {
  async create(data: CreateOrderStatusChangeData): Promise<OrderStatusChangeDocument> {
    return OrderStatusChangeModel.create(data);
  },

  /** Oldest first. */
  async listByOrderNumber(orderNumber: string): Promise<OrderStatusChangeDocument[]> {
    return OrderStatusChangeModel.find({ orderNumber }).sort({ changedAt: 1, _id: 1 });
  },

  /** Oldest first. Chunked like packingRecordRepository.findByOrderNumbers. */
  async findByOrderNumbers(orderNumbers: string[]): Promise<OrderStatusChangeDocument[]> {
    const CHUNK = 1000;
    const found: OrderStatusChangeDocument[] = [];
    for (let i = 0; i < orderNumbers.length; i += CHUNK) {
      found.push(...(await OrderStatusChangeModel.find({ orderNumber: { $in: orderNumbers.slice(i, i + CHUNK) } })));
    }
    return found.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime() || String(a._id).localeCompare(String(b._id)));
  },
};
