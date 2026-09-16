import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as packingService from "../services/packingService";
import type { ListPackingQuery, OrderNumberParam } from "../validators/packingValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as unknown as ListPackingQuery;
  const result = await packingService.listOrdersForPacking(days);
  return sendSuccess(res, result);
});

export const sendOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  const result = await packingService.markOrderPacked(orderNumber);
  return sendSuccess(res, result);
});
