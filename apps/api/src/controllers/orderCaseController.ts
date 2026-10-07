import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { serializeCase } from "../utils/serializers";
import * as orderCaseService from "../services/orderCaseService";
import type { OrderNumberParam } from "../validators/orderPrecheckValidators";
import type { CreateOrderCaseInput } from "../validators/orderCaseValidators";

export const getContext = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  return sendSuccess(res, await orderCaseService.getOrderCaseContext(orderNumber));
});

export const createCase = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  const result = await orderCaseService.createOrderCase(orderNumber, req.body as CreateOrderCaseInput, req.currentUser);
  return sendCreated(res, { case: serializeCase(result.case), orderSynced: result.orderSynced });
});
