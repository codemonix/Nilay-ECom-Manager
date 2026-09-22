import type { ListUserActivityLogsQuery } from "../validators/logValidators";
import { userActivityLogRepository, type CreateUserActivityLogData } from "../repositories/userActivityLogRepository";
import { serializeUserActivityLog } from "../utils/serializers";
import { logger } from "../config/logger";
import { redactor } from "../config/redactor";

/**
 * Called fire-and-forget from middleware/activityLogger.ts. Never throws --
 * a failure to record activity must not affect the request it describes,
 * and is reported through the ordinary system logger instead.
 */
export async function record(data: CreateUserActivityLogData): Promise<void> {
  try {
    await userActivityLogRepository.create({ ...data, path: redactor.scrubString(data.path) });
  } catch (err) {
    logger.error("Failed to record user activity log", { err });
  }
}

export async function listUserActivityLogs(query: ListUserActivityLogsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const { items, total } = await userActivityLogRepository.list({
    page,
    pageSize,
    userId: query.userId,
    search: query.search,
    from: query.from,
    to: query.to,
  });
  return {
    items: items.map(serializeUserActivityLog),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
