import { PACKAGE_STATUS_VALUES, type PackageStatus } from "@complaint-system/shared";
import type { PackageEventDocument } from "../models/PackageEvent";
import { packageEventRepository } from "../repositories/packageEventRepository";
import { packageRepository } from "../repositories/packageRepository";

export interface PurchasingOverview {
  countsByStatus: Record<PackageStatus, number>;
  itemsPendingMatch: number;
  itemsPendingInventoryDecision: number;
  recentEvents: PackageEventDocument[];
}

/**
 * Read-only aggregation over Package/PackageEvent -- no new write paths,
 * mirroring the low-risk framing docs/future-modules.md gives the analogous
 * (still-planned) Reporting module. Matching a Shopfa code is not gated by
 * package status, so "pending match"/"pending inventory decision" are
 * counted across every package regardless of stage.
 */
export async function getOverview(): Promise<PurchasingOverview> {
  const statusCounts = await packageRepository.countByStatus();
  const countsByStatus = Object.fromEntries(PACKAGE_STATUS_VALUES.map((status) => [status, 0])) as Record<
    PackageStatus,
    number
  >;
  for (const row of statusCounts) {
    countsByStatus[row._id as PackageStatus] = row.count;
  }

  const [itemsPendingMatch, itemsPendingInventoryDecision, recentEvents] = await Promise.all([
    packageRepository.countItemsPendingMatch(),
    packageRepository.countItemsPendingInventoryDecision(),
    packageEventRepository.findRecent(20),
  ]);

  return {
    countsByStatus,
    itemsPendingMatch,
    itemsPendingInventoryDecision,
    recentEvents,
  };
}
