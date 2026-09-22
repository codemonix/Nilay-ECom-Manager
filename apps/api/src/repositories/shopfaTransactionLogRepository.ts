import { ShopfaTransactionLogModel, type ShopfaTransactionLogDocument } from "../models/ShopfaTransactionLog";
import type { CollectionStats } from "../utils/collectionStats";
import { getCollectionStats } from "../utils/collectionStats";
import { escapeRegex } from "../utils/regex";

export interface CreateShopfaTransactionLogData {
  method: string;
  endpoint: string;
  requestParams?: unknown;
  statusCode: number | null;
  success: boolean;
  durationMs: number;
  errorMessage?: string | null;
}

export interface ListShopfaTransactionLogsParams {
  page: number;
  pageSize: number;
  success?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
}

function buildFilter(params: ListShopfaTransactionLogsParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.success !== undefined) filter.success = params.success;
  if (params.search) {
    const regex = new RegExp(escapeRegex(params.search.trim()), "i");
    filter.$or = [{ endpoint: regex }, { errorMessage: regex }];
  }
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }
  return filter;
}

export const shopfaTransactionLogRepository = {
  async create(data: CreateShopfaTransactionLogData): Promise<void> {
    await ShopfaTransactionLogModel.create(data);
  },

  async getStats(): Promise<CollectionStats> {
    return getCollectionStats(ShopfaTransactionLogModel);
  },

  async list(
    params: ListShopfaTransactionLogsParams,
  ): Promise<{ items: ShopfaTransactionLogDocument[]; total: number }> {
    const filter = buildFilter(params);
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      ShopfaTransactionLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.pageSize),
      ShopfaTransactionLogModel.countDocuments(filter),
    ]);
    return { items, total };
  },
};
