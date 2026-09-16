import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as shopfaProductService from "../services/shopfaProductService";
import type { SearchShopfaProductsQuery } from "../validators/shopfaProductValidators";

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as SearchShopfaProductsQuery;
  const results = await shopfaProductService.searchProducts(q);
  return sendSuccess(res, results);
});
