import type { ListShopfaTransactionLogsQuery } from "../validators/logValidators";
import {
  shopfaTransactionLogRepository,
  type CreateShopfaTransactionLogData,
} from "../repositories/shopfaTransactionLogRepository";
import { serializeShopfaTransactionLog } from "../utils/serializers";
import { logger } from "../config/logger";

/**
 * Called fire-and-forget from the axios interceptors in
 * integrations/shopfa/shopfaClient.ts. Never throws -- a failure to record
 * a transaction must not affect the Shopfa call it describes.
 */
export async function record(data: CreateShopfaTransactionLogData): Promise<void> {
  try {
    await shopfaTransactionLogRepository.create(data);
  } catch (err) {
    logger.error("Failed to record Shopfa transaction log", { err });
  }
}

export async function listShopfaTransactionLogs(query: ListShopfaTransactionLogsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const { items, total } = await shopfaTransactionLogRepository.list({
    page,
    pageSize,
    success: query.success,
    search: query.search,
    from: query.from,
    to: query.to,
  });
  return {
    items: items.map(serializeShopfaTransactionLog),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
