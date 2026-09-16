import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as devToolsService from "../services/devToolsService";
import type {
  GetSoldQuantityParams,
  GetSoldQuantityQuery,
  OrderAdminNoteParams,
  SearchDevToolsItemsQuery,
  TitleAsteriskParams,
  UpdateOrderAdminNoteBody,
} from "../validators/devToolsValidators";

export const searchItems = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as SearchDevToolsItemsQuery;
  const results = await devToolsService.searchItems(q);
  return sendSuccess(res, results);
});

export const getSoldQuantity = asyncHandler(async (req: Request, res: Response) => {
  const { productCode } = req.params as unknown as GetSoldQuantityParams;
  const { days } = req.query as unknown as GetSoldQuantityQuery;
  const result = await devToolsService.getSoldQuantity(productCode, days);
  return sendSuccess(res, result);
});

export const checkTitleAsterisk = asyncHandler(async (req: Request, res: Response) => {
  const { productCode } = req.params as unknown as TitleAsteriskParams;
  const result = await devToolsService.checkTitleAsterisk(productCode);
  return sendSuccess(res, result);
});

export const toggleTitleAsterisk = asyncHandler(async (req: Request, res: Response) => {
  const { productCode } = req.params as unknown as TitleAsteriskParams;
  const result = await devToolsService.toggleTitleAsterisk(productCode);
  return sendSuccess(res, result);
});

export const getOrderAdminNote = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderAdminNoteParams;
  const result = await devToolsService.getOrderAdminNote(orderNumber);
  return sendSuccess(res, result);
});

export const updateOrderAdminNote = asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params as unknown as OrderAdminNoteParams;
  const { note } = req.body as unknown as UpdateOrderAdminNoteBody;
  const result = await devToolsService.updateOrderAdminNote(orderNumber, note);
  return sendSuccess(res, result);
});
