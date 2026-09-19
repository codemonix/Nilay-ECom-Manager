import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as packingService from "../services/packingService";
import type {
  ListPackingHistoryQuery,
  ListPackingQuery,
  OrderNumberParam,
  SendPackedOrderInput,
} from "../validators/packingValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as unknown as ListPackingQuery;
  const result = await packingService.listOrdersForPacking(days);
  return sendSuccess(res, result);
});

export const sendOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  const { externalOrderId, buyerName, items } = req.body as SendPackedOrderInput;
  const result = await packingService.markOrderPacked(
    orderNumber,
    { externalOrderId, buyerName, items },
    req.file,
    req.currentUser,
  );
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
