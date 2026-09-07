import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as systemLogService from "../services/systemLogService";
import * as userActivityLogService from "../services/userActivityLogService";
import * as shopfaTransactionLogService from "../services/shopfaTransactionLogService";
import type { ListSystemLogsQuery, ListUserActivityLogsQuery, ListShopfaTransactionLogsQuery } from "../validators/logValidators";

export const listSystemLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSystemLogsQuery;
  const result = await systemLogService.listSystemLogs(query);
  return sendSuccess(res, result.items, 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const listUserActivityLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListUserActivityLogsQuery;
  const result = await userActivityLogService.listUserActivityLogs(query);
  return sendSuccess(res, result.items, 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const listShopfaTransactionLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListShopfaTransactionLogsQuery;
  const result = await shopfaTransactionLogService.listShopfaTransactionLogs(query);
  return sendSuccess(res, result.items, 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});
