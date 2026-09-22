import type { Request, Response } from "express";
import type { CategoryTrendMonths } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as reportingService from "../services/reportingService";
import type {
  CategoryTrendsQuery,
  CustomerReportQuery,
  ItemSalesQuery,
  ProductSearchQuery,
  ShortageReportQuery,
} from "../validators/reportingValidators";

export const getShortageReport = asyncHandler(async (req: Request, res: Response) => {
  const { statusCodes, days } = req.query as unknown as ShortageReportQuery;
  const result = await reportingService.buildShortageReport(statusCodes, days);
  return sendSuccess(res, result);
});

export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportingService.getOrderDetails(req.params.orderNumber as string);
  return sendSuccess(res, result);
});

export const getCustomerReport = asyncHandler(async (req: Request, res: Response) => {
  const { query, from, to } = req.query as unknown as CustomerReportQuery;
  return sendSuccess(res, await reportingService.buildCustomerReport(query, from, to));
});

export const getItemSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const { productId, categoryId, from, to } = req.query as unknown as ItemSalesQuery;
  return sendSuccess(res, await reportingService.buildItemSalesReport({ productId, categoryId }, from, to));
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, await reportingService.listCategories());
});

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as ProductSearchQuery;
  return sendSuccess(res, await reportingService.searchProducts(q));
});

export const getCategoryTrends = asyncHandler(async (req: Request, res: Response) => {
  const { months, stepDays } = req.query as unknown as CategoryTrendsQuery;
  return sendSuccess(res, await reportingService.buildCategoryTrends(months as CategoryTrendMonths, stepDays));
});
