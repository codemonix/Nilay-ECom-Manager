import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { serializePackageEvent } from "../utils/serializers";
import * as purchasingOverviewService from "../services/purchasingOverviewService";

export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await purchasingOverviewService.getOverview();
  return sendSuccess(res, {
    countsByStatus: overview.countsByStatus,
    itemsPendingMatch: overview.itemsPendingMatch,
    itemsPendingInventoryDecision: overview.itemsPendingInventoryDecision,
    recentEvents: overview.recentEvents.map(serializePackageEvent),
  });
});
