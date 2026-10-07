import { Types } from "mongoose";
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

/** A period, optionally narrowed to one acting user and/or one order -- the filters of the Order Activity Log report. */
export interface OrderAuditFilter {
  from: Date;
  to: Date;
  userId?: string;
  orderNumber?: string;
}

function auditQuery(filter: OrderAuditFilter) {
  return {
    changedAt: { $gte: filter.from, $lte: filter.to },
    ...(filter.userId ? { changedBy: new Types.ObjectId(filter.userId) } : {}),
    ...(filter.orderNumber ? { orderNumber: filter.orderNumber } : {}),
  };
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

  /** Newest first, at most `limit`. */
  async listForAudit(filter: OrderAuditFilter, limit: number): Promise<OrderStatusChangeDocument[]> {
    return OrderStatusChangeModel.find(auditQuery(filter)).sort({ changedAt: -1, _id: -1 }).limit(limit);
  },

  async countForAudit(filter: OrderAuditFilter): Promise<number> {
    return OrderStatusChangeModel.countDocuments(auditQuery(filter));
  },

  async countForAuditByActor(filter: OrderAuditFilter): Promise<{ actorId: string | null; actorName: string | null; count: number }[]> {
    const rows = await OrderStatusChangeModel.aggregate<{ _id: { id: Types.ObjectId | null; name: string | null }; count: number }>([
      { $match: auditQuery(filter) },
      { $group: { _id: { id: "$changedBy", name: "$changedByName" }, count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ actorId: row._id.id ? String(row._id.id) : null, actorName: row._id.name ?? null, count: row.count }));
  },
};
