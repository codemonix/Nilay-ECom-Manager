import type { Request, Response } from "express";
import type { OrderPrecheckListResultDTO } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as orderPrecheckService from "../services/orderPrecheckService";
import type {
  ListOrderPrecheckQuery,
  OrderNumberParam,
  SaveOrderPrecheckInput,
} from "../validators/orderPrecheckValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { statusCodes } = req.query as unknown as ListOrderPrecheckQuery;
  const orders = await orderPrecheckService.listOrdersForPrecheck(statusCodes);
  const result: OrderPrecheckListResultDTO = { statusCodes, orders, generatedAtISO: new Date().toISOString() };
  return sendSuccess(res, result);
});

export const saveOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderNumberParam;
  const { items, confirmStatusChanges } = req.body as SaveOrderPrecheckInput;
  const result = await orderPrecheckService.saveOrderPrecheck(orderNumber, items, confirmStatusChanges ?? false);
  return sendSuccess(res, result);
});
