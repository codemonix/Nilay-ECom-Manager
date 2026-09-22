import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as ordersByStatusService from "../services/ordersByStatusService";
import type { OrdersByStatusQuery } from "../validators/ordersByStatusValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { statusCodes, days } = req.query as unknown as OrdersByStatusQuery;
  return sendSuccess(res, await ordersByStatusService.listOrdersByStatus(statusCodes, days));
});
