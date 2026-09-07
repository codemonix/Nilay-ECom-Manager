import { SystemLogModel, type SystemLogDocument } from "../models/SystemLog";
import { escapeRegex } from "../utils/regex";

export interface CreateSystemLogData {
  level: string;
  message: string;
  context?: string | null;
  meta?: unknown;
}

export interface ListSystemLogsParams {
  page: number;
  pageSize: number;
  level?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

function buildFilter(params: ListSystemLogsParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.level) filter.level = params.level;
  if (params.search) {
    const regex = new RegExp(escapeRegex(params.search.trim()), "i");
    filter.$or = [{ message: regex }, { context: regex }];
  }
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }
  return filter;
}

export const systemLogRepository = {
  async create(data: CreateSystemLogData): Promise<void> {
    await SystemLogModel.create(data);
  },

  async list(params: ListSystemLogsParams): Promise<{ items: SystemLogDocument[]; total: number }> {
    const filter = buildFilter(params);
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      SystemLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.pageSize),
      SystemLogModel.countDocuments(filter),
    ]);
    return { items, total };
  },
};
