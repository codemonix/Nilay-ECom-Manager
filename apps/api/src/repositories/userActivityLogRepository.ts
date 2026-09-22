import { UserActivityLogModel, type UserActivityLogDocument } from "../models/UserActivityLog";
import type { CollectionStats } from "../utils/collectionStats";
import { getCollectionStats } from "../utils/collectionStats";
import { escapeRegex } from "../utils/regex";

export interface CreateUserActivityLogData {
  userId: string | null;
  userName: string;
  userRole: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip?: string | null;
}

export interface ListUserActivityLogsParams {
  page: number;
  pageSize: number;
  userId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

function buildFilter(params: ListUserActivityLogsParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.userId) filter.userId = params.userId;
  if (params.search) {
    const regex = new RegExp(escapeRegex(params.search.trim()), "i");
    filter.$or = [{ userName: regex }, { path: regex }];
  }
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }
  return filter;
}

export const userActivityLogRepository = {
  async create(data: CreateUserActivityLogData): Promise<void> {
    await UserActivityLogModel.create(data);
  },

  async getStats(): Promise<CollectionStats> {
    return getCollectionStats(UserActivityLogModel);
  },

  async list(params: ListUserActivityLogsParams): Promise<{ items: UserActivityLogDocument[]; total: number }> {
    const filter = buildFilter(params);
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      UserActivityLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.pageSize),
      UserActivityLogModel.countDocuments(filter),
    ]);
    return { items, total };
  },
};
