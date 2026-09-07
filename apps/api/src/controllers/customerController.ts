import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as customerService from "../services/customerService";

export const getCustomerSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await customerService.getCustomerSummary(req.params.externalCustomerId as string);
  return sendSuccess(res, summary);
});

export const searchCustomers = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q as string) ?? "";
  const results = await customerService.searchCustomers(query);
  return sendSuccess(res, results);
});
