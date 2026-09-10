import { SystemLogModel } from "../models/SystemLog";
import { logger } from "../config/logger";
import { getCollectionStats } from "../utils/collectionStats";

/** Total on-disk size the SystemLog collection is allowed to grow to before the oldest entries get pruned. */
const MAX_SYSTEM_LOG_BYTES = 50 * 1024 * 1024;
const PRUNE_BATCH_SIZE = 500;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Safety bound on how many batches one sweep will prune, so a runaway write burst can't turn this into an unbounded loop. */
const MAX_BATCHES_PER_SWEEP = 50;

/**
 * Age-based retention (60 days) is handled natively by MongoDB's TTL index
 * on SystemLog.createdAt (see models/SystemLog.ts) and needs no code here.
 * A size cap has no built-in MongoDB equivalent for a regular collection
 * (only capped collections cap by size, and those can't combine with a TTL
 * index), so it's enforced here instead: periodically check the
 * collection's on-disk size via $collStats, and if it's over the limit,
 * delete the oldest documents in batches until back under it.
 */
export async function enforceSystemLogSizeLimit(): Promise<void> {
  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_SWEEP; batch += 1) {
      const { sizeBytes } = await getCollectionStats(SystemLogModel);
      if (sizeBytes <= MAX_SYSTEM_LOG_BYTES) return;

      const oldest = await SystemLogModel.find().sort({ createdAt: 1 }).limit(PRUNE_BATCH_SIZE).select("_id").lean();
      if (oldest.length === 0) return;
      await SystemLogModel.deleteMany({ _id: { $in: oldest.map((doc) => doc._id) } });
    }
  } catch (err) {
    logger.error("Failed to enforce SystemLog size limit", { err });
  }
}

let intervalHandle: NodeJS.Timeout | undefined;

/**
 * Starts the periodic size-cap sweep. Call once at server boot (see
 * server.ts) -- never on module import, since tests construct the Express
 * app directly via createApp() without booting this background job.
 */
export function startSystemLogRetentionJob(): void {
  if (intervalHandle) return;
  void enforceSystemLogSizeLimit();
  intervalHandle = setInterval(() => void enforceSystemLogSizeLimit(), CHECK_INTERVAL_MS);
  intervalHandle.unref();
}
