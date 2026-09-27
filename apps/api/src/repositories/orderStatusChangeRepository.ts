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
};
