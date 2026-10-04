import type { PipelineStage } from "mongoose";
import { SecurityEventType, type SecuritySeverity } from "@complaint-system/shared";
import { SecurityEventModel, type SecurityEventDocument } from "../models/SecurityEvent";
import { escapeRegex } from "../utils/regex";

export interface CreateSecurityEventData {
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string | null;
  userName?: string | null;
  targetEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;
  details?: unknown;
}

export interface ListSecurityEventsParams {
  page: number;
  pageSize: number;
  type?: string;
  severity?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

function buildFilter(params: ListSecurityEventsParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.type) filter.type = params.type;
  if (params.severity) filter.severity = params.severity;
  if (params.search) {
    const regex = new RegExp(escapeRegex(params.search.trim()), "i");
    filter.$or = [{ ip: regex }, { targetEmail: regex }, { userName: regex }, { path: regex }];
  }
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }
  return filter;
}

export interface IpAggregateRow {
  ip: string;
  total: number;
  failedLogins: number;
  distinctAccounts: number;
  tokenAbuse: number;
  lastSeenAt: Date;
}

export interface AccountAggregateRow {
  email: string;
  failedLogins: number;
  distinctIps: number;
  lastSeenAt: Date;
}

export interface UserDeniedAggregateRow {
  userName: string;
  count: number;
  lastSeenAt: Date;
}

const FAILED_LOGIN_TYPES = [SecurityEventType.LOGIN_FAILED, SecurityEventType.LOGIN_THROTTLED];
const TOKEN_ABUSE_TYPES = [SecurityEventType.INVALID_ACCESS_TOKEN, SecurityEventType.REFRESH_TOKEN_REUSE];

export const securityEventRepository = {
  async create(data: CreateSecurityEventData): Promise<void> {
    await SecurityEventModel.create(data);
  },

  async list(params: ListSecurityEventsParams): Promise<{ items: SecurityEventDocument[]; total: number }> {
    const filter = buildFilter(params);
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      SecurityEventModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.pageSize),
      SecurityEventModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  async countBy(field: "type" | "severity", from: Date, to: Date): Promise<Array<{ key: string; count: number }>> {
    const rows = await SecurityEventModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return rows.map((row) => ({ key: row._id, count: row.count }));
  },

  async aggregateByIp(from: Date, to: Date, limit: number): Promise<IpAggregateRow[]> {
    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: from, $lte: to }, ip: { $ne: null } } },
      {
        $group: {
          _id: "$ip",
          total: { $sum: 1 },
          failedLogins: { $sum: { $cond: [{ $in: ["$type", FAILED_LOGIN_TYPES] }, 1, 0] } },
          tokenAbuse: { $sum: { $cond: [{ $in: ["$type", TOKEN_ABUSE_TYPES] }, 1, 0] } },
          accounts: {
            $addToSet: { $cond: [{ $in: ["$type", FAILED_LOGIN_TYPES] }, "$targetEmail", "$$REMOVE"] },
          },
          lastSeenAt: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          ip: "$_id",
          total: 1,
          failedLogins: 1,
          tokenAbuse: 1,
          distinctAccounts: { $size: "$accounts" },
          lastSeenAt: 1,
        },
      },
      { $sort: { failedLogins: -1, total: -1 } },
      { $limit: limit },
    ];
    return SecurityEventModel.aggregate<IpAggregateRow>(pipeline);
  },

  async aggregateTargetedAccounts(from: Date, to: Date, limit: number): Promise<AccountAggregateRow[]> {
    return SecurityEventModel.aggregate<AccountAggregateRow>([
      { $match: { createdAt: { $gte: from, $lte: to }, type: { $in: FAILED_LOGIN_TYPES }, targetEmail: { $ne: null } } },
      {
        $group: {
          _id: "$targetEmail",
          failedLogins: { $sum: 1 },
          ips: { $addToSet: "$ip" },
          lastSeenAt: { $max: "$createdAt" },
        },
      },
      { $project: { _id: 0, email: "$_id", failedLogins: 1, distinctIps: { $size: "$ips" }, lastSeenAt: 1 } },
      { $sort: { failedLogins: -1 } },
      { $limit: limit },
    ]);
  },

  async aggregateAccessDeniedByUser(from: Date, to: Date, minCount: number): Promise<UserDeniedAggregateRow[]> {
    return SecurityEventModel.aggregate<UserDeniedAggregateRow>([
      { $match: { createdAt: { $gte: from, $lte: to }, type: SecurityEventType.ACCESS_DENIED, userId: { $ne: null } } },
      { $group: { _id: "$userId", userName: { $last: "$userName" }, count: { $sum: 1 }, lastSeenAt: { $max: "$createdAt" } } },
      { $match: { count: { $gte: minCount } } },
      { $project: { _id: 0, userName: 1, count: 1, lastSeenAt: 1 } },
      { $sort: { count: -1 } },
    ]);
  },
};
