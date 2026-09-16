import { PACKAGE_STATUS_VALUES, type PackageStatus } from "@complaint-system/shared";
import { PackageModel } from "../models/Package";
import { PackageEventModel, type PackageEventDocument } from "../models/PackageEvent";

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
  const statusCounts = await PackageModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const countsByStatus = Object.fromEntries(PACKAGE_STATUS_VALUES.map((status) => [status, 0])) as Record<
    PackageStatus,
    number
  >;
  for (const row of statusCounts) {
    countsByStatus[row._id as PackageStatus] = row.count;
  }

  const [pendingMatch, pendingInventoryDecision, recentEvents] = await Promise.all([
    PackageModel.aggregate<{ count: number }>([
      { $unwind: "$items" },
      { $match: { "items.matchedAt": null } },
      { $count: "count" },
    ]),
    PackageModel.aggregate<{ count: number }>([
      { $unwind: "$items" },
      { $match: { "items.inventoryPending": true } },
      { $count: "count" },
    ]),
    PackageEventModel.find().sort({ createdAt: -1 }).limit(20).populate("actorId", "name role"),
  ]);

  return {
    countsByStatus,
    itemsPendingMatch: pendingMatch[0]?.count ?? 0,
    itemsPendingInventoryDecision: pendingInventoryDecision[0]?.count ?? 0,
    recentEvents: recentEvents as PackageEventDocument[],
  };
}
