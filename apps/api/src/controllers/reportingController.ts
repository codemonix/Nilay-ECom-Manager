import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as reportingService from "../services/reportingService";
import type { ShortageReportQuery } from "../validators/reportingValidators";

export const getShortageReport = asyncHandler(async (req: Request, res: Response) => {
  const { statusCodes, days } = req.query as unknown as ShortageReportQuery;
  const result = await reportingService.buildShortageReport(statusCodes, days);
  return sendSuccess(res, result);
});
