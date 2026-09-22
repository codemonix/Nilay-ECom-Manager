import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as packingService from "../services/packingService";
import type {
  ListPackingHistoryQuery,
  ListPackingQuery,
  SendPackedOrdersInput,
} from "../validators/packingValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as unknown as ListPackingQuery;
  const result = await packingService.listOrdersForPacking(days);
  return sendSuccess(res, result);
});

export const sendOrders = asyncHandler(async (req: Request, res: Response) => {
  const { orders } = req.body as SendPackedOrdersInput;
  const photos = (req.files as Express.Multer.File[] | undefined) ?? [];
  const result = await packingService.markOrdersPacked(orders, photos, req.currentUser);
  return sendSuccess(res, result);
});

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListPackingHistoryQuery;
  const result = await packingService.listPackingHistory(query);
  return sendSuccess(res, result.items, 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});
