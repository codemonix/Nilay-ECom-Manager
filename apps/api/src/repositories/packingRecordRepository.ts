import { PackingRecordModel, type PackingRecordDocument } from "../models/PackingRecord";

export interface CreatePackingRecordData {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  items: { productCode: string; title: string; quantity: number }[];
  statusCodeAfterSend: number;
  statusTitleAfterSend: string;
  sentBy: string | null;
  sentByName: string | null;
  sentAt: Date;
}

export interface ListPackingRecordsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export const packingRecordRepository = {
  async create(data: CreatePackingRecordData): Promise<PackingRecordDocument> {
    return PackingRecordModel.create(data);
  },

  /** Case-insensitive substring match on order number or buyer name, same convention as importedOrderRepository.list. */
  async list({ page, pageSize, search }: ListPackingRecordsParams): Promise<{ items: PackingRecordDocument[]; total: number }> {
    const filter = search
      ? {
          $or: [
            { orderNumber: { $regex: search, $options: "i" } },
            { buyerName: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      PackingRecordModel.find(filter)
        .sort({ sentAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      PackingRecordModel.countDocuments(filter),
    ]);
    return { items, total };
  },
};
