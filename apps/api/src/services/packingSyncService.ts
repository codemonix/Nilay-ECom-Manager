import { OrderStatusChangeSource, OrderWorkflowStatus, ShopfaSyncStatus } from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { buildPackingPhotoNote } from "../integrations/shopfa/packingNoteMarker";
import { PackingRecordModel, type PackingRecordDocument } from "../models/PackingRecord";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { recordStatusChange } from "./orderWorkflowService";

/** After this many failed pushes a record stops being retried automatically and becomes FAILED. */
export const PACKING_SYNC_MAX_ATTEMPTS = 8;
/** Backoff before retry N (1-based): 1, 2, 4, ... minutes, capped at an hour -- 8 attempts span roughly two hours. */
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_CAP_MS = 60 * 60 * 1000;
/** A push in flight holds its record this long, so the background worker and a manual retry never push the same record at once. */
const SYNC_LEASE_MS = 2 * 60 * 1000;

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

/** Thrown for a push that can never succeed by retrying (the order doesn't exist on Shopfa). */
class PermanentSyncError extends Error {}

/**
 * Atomically takes the lease on a record for one push attempt. Returns null
 * when the record is synced already, or another push holds it right now.
 * `allowFailed` lets a manual retry revive a FAILED record.
 */
async function claim(recordId: string, allowFailed: boolean): Promise<PackingRecordDocument | null> {
  const now = new Date();
  const statuses = allowFailed ? [ShopfaSyncStatus.PENDING_SYNC, ShopfaSyncStatus.FAILED] : [ShopfaSyncStatus.PENDING_SYNC];
  return PackingRecordModel.findOneAndUpdate(
    {
      _id: recordId,
      syncStatus: { $in: statuses },
      $or: [{ nextSyncAt: null }, { nextSyncAt: { $lte: now } }, ...(allowFailed ? [{ syncStatus: ShopfaSyncStatus.FAILED }] : [])],
    },
    {
      $set: {
        syncStatus: ShopfaSyncStatus.PENDING_SYNC,
        nextSyncAt: new Date(now.getTime() + SYNC_LEASE_MS),
        ...(allowFailed ? { syncAttempts: 0 } : {}),
      },
    },
    { new: true },
  );
}

/**
 * One push of a packed order to Shopfa: "ارسال شده" plus the photo count in
 * the admin note, in a single write (the note keeps its other content). The
 * write is verified by reading the order back. Success marks the record
 * SYNCED and logs the status change. A transient failure (Shopfa unreachable,
 * or the change didn't stick) leaves it PENDING_SYNC with a backoff, or FAILED
 * once PACKING_SYNC_MAX_ATTEMPTS is used up. An order that no longer exists
 * on Shopfa fails right away, since retrying can't help.
 */
async function push(record: PackingRecordDocument): Promise<PackingRecordDocument> {
  const attempts = (record.syncAttempts ?? 0) + 1;
  try {
    const client = await getShopfaClient();
    const existing = await client.getOrderAdminNote(record.orderNumber);
    if (!existing) throw new PermanentSyncError("Order not found on Shopfa");
    const result = await client.updateOrderNoteAndStatus(record.orderNumber, {
      note: buildPackingPhotoNote(existing.note, record.photoCount ?? 0),
      statusCode: OrderWorkflowStatus.SENT,
    });
    if (!result) throw new PermanentSyncError("Order not found on Shopfa");
    if (result.statusCode !== OrderWorkflowStatus.SENT) {
      throw new Error(`Shopfa reports status ${result.statusCode} after the write, expected ${OrderWorkflowStatus.SENT}`);
    }

    record.set({
      syncStatus: ShopfaSyncStatus.SYNCED,
      syncAttempts: attempts,
      lastSyncError: null,
      nextSyncAt: null,
      syncedAt: new Date(),
      statusCodeAfterSend: result.statusCode,
      statusTitleAfterSend: result.statusTitle,
    });
    await record.save();
    await recordStatusChange({
      orderNumber: record.orderNumber,
      fromStatusCode: OrderWorkflowStatus.SENT_TO_POST,
      toStatusCode: result.statusCode,
      toStatusTitle: result.statusTitle,
      source: OrderStatusChangeSource.PACKING,
      actor: record.sentBy ? { id: String(record.sentBy), name: record.sentByName ?? "" } : null,
    });
    return record;
  } catch (err) {
    const permanent = err instanceof PermanentSyncError;
    const message = err instanceof ApiError || err instanceof Error ? err.message : "Unexpected error";
    const giveUp = permanent || attempts >= PACKING_SYNC_MAX_ATTEMPTS;
    record.set({
      syncStatus: giveUp ? ShopfaSyncStatus.FAILED : ShopfaSyncStatus.PENDING_SYNC,
      syncAttempts: attempts,
      lastSyncError: message,
      nextSyncAt: giveUp ? null : new Date(Date.now() + backoffMs(attempts)),
    });
    await record.save();
    if (giveUp) {
      logger.error("Packing: giving up pushing a packed order to Shopfa -- needs a manual retry", {
        orderNumber: record.orderNumber,
        attempts,
        err,
      });
    } else {
      logger.warn("Packing: pushing a packed order to Shopfa failed, will retry", {
        orderNumber: record.orderNumber,
        attempts,
        err,
      });
    }
    return record;
  }
}

/** Lease for a record about to be created and pushed inline, so the background worker leaves it alone meanwhile. */
export function newRecordLease(): Date {
  return new Date(Date.now() + SYNC_LEASE_MS);
}

/** First push, right after the record was created with newRecordLease(). */
export async function pushNewRecord(record: PackingRecordDocument): Promise<PackingRecordDocument> {
  return push(record);
}

/** Manual retry of one record (PENDING_SYNC or FAILED) -- resets its retry budget. */
export async function retryRecord(recordId: string): Promise<PackingRecordDocument> {
  const claimed = await claim(recordId, true);
  if (!claimed) {
    const record = await packingRecordRepository.findById(recordId);
    if (!record) throw ApiError.notFound("Packing record not found");
    if (record.syncStatus === ShopfaSyncStatus.SYNCED) return record;
    throw ApiError.conflict("This record is being pushed to Shopfa right now");
  }
  return push(claimed);
}

/** One pass of the background retry worker: pushes every PENDING_SYNC record whose backoff has elapsed. Returns how many were attempted. */
export async function runDueSyncs(limit = 20): Promise<number> {
  const due = await packingRecordRepository.findDueForSync(new Date(), limit);
  let attempted = 0;
  for (const candidate of due) {
    const claimed = await claim(String(candidate._id), false);
    if (!claimed) continue;
    attempted += 1;
    await push(claimed);
  }
  return attempted;
}
