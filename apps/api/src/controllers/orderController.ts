import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as orderService from "../services/orderService";
import type { ListOrdersQuery } from "../validators/orderValidators";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListOrdersQuery;
  const result = await orderService.listImportedOrders(query);
  return sendSuccess(res, result.items, 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getImportedOrder(req.params.externalOrderId as string);
  return sendSuccess(res, order);
});
