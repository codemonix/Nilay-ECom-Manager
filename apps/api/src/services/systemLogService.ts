import type { ListSystemLogsQuery } from "../validators/logValidators";
import { systemLogRepository } from "../repositories/systemLogRepository";
import { serializeSystemLog } from "../utils/serializers";

export async function listSystemLogs(query: ListSystemLogsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const { items, total } = await systemLogRepository.list({
    page,
    pageSize,
    level: query.level,
    search: query.search,
    from: query.from,
    to: query.to,
  });
  return {
    items: items.map(serializeSystemLog),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
