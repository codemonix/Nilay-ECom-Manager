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
  /** Newest first, so callers wanting "the latest record per order" can keep the first they see. Chunked so a page of thousands of order numbers stays a reasonable query. */
  async findByOrderNumbers(orderNumbers: string[]): Promise<PackingRecordDocument[]> {
    const CHUNK = 1000;
    const found: PackingRecordDocument[] = [];
    for (let i = 0; i < orderNumbers.length; i += CHUNK) {
      found.push(...(await PackingRecordModel.find({ orderNumber: { $in: orderNumbers.slice(i, i + CHUNK) } })));
    }
    return found.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  },

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
