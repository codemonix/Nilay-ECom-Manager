import type { Model } from "mongoose";

export interface CollectionStats {
  sizeBytes: number;
  documentCount: number;
}

interface CollStatsResult {
  storageStats?: { size?: number; count?: number };
}

/**
 * Reads a collection's real on-disk size and document count via the
 * `$collStats` aggregation stage -- used by the SystemLog size-cap job
 * (jobs/systemLogRetentionJob.ts) and by the admin Settings page's log-size
 * display (services/settingsService.ts#getLogSizes).
 *
 * `Model<any>` (not `Model<unknown>`) is intentional: mongoose's Model
 * generic is invariant in ways that make every concrete model
 * (`Model<SystemLogSchemaType>`, etc.) fail to satisfy `Model<unknown>` at
 * the call site, even though this function never reads the document shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export async function getCollectionStats(model: Model<any>): Promise<CollectionStats> {
  const [stats] = await model.aggregate<CollStatsResult>([{ $collStats: { storageStats: {} } }]);
  return {
    sizeBytes: stats?.storageStats?.size ?? 0,
    documentCount: stats?.storageStats?.count ?? 0,
  };
}
