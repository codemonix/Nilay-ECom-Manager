import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as orderWorkflowService from "../services/orderWorkflowService";
import type { OrderNumberParam } from "../validators/orderPrecheckValidators";

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  const result = await orderWorkflowService.getOrderHistory(orderNumber);
  return sendSuccess(res, result);
});
