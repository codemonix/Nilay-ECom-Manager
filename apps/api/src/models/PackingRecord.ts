import { ShopfaSyncStatus } from "@complaint-system/shared";
import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";

const packingRecordItemSchema = new Schema(
  {
    productCode: { type: String, required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * A local record of every order Packing has sent, kept independently of
 * Shopfa -- live-API orders themselves are never persisted locally (see
 * ImportedOrder for the separate xlsx-import cache), so without this table
 * there would be nowhere to browse packing history or its confirmation
 * photo after the fact. `items`/`buyerName` are a denormalized snapshot
 * taken at send time (from what the Packing page already had loaded), not
 * a live reference -- a later change to the order on Shopfa shouldn't
 * rewrite history, and this avoids an extra Shopfa round-trip just to
 * re-fetch data the client already has. The confirmation photo is a normal
 * Attachment (subjectType PACKING_RECORD, subjectId this document's _id),
 * reusing the same upload/serving pipeline as Case/Package attachments,
 * rather than a bespoke image field here.
 */
const packingRecordSchema = new Schema(
  {
    externalOrderId: { type: String, required: true },
    orderNumber: { type: String, required: true, index: true },
    buyerName: { type: String, default: null },
    items: { type: [packingRecordItemSchema], default: [] },
    /** Set once Shopfa confirmed the "ارسال شده" write (see packingSyncService); null while the push is still pending or failed. */
    statusCodeAfterSend: { type: Number, default: null },
    statusTitleAfterSend: { type: String, default: null },
    /** How many confirmation photos the group had -- written into the order's Shopfa admin note alongside the status (the photos themselves stay local). */
    photoCount: { type: Number, default: 0 },
    /**
     * Whether the "ارسال شده" status + photo-count note reached Shopfa. A
     * failed push stays PENDING_SYNC and is retried in the background with
     * backoff (nextSyncAt); after PACKING_SYNC_MAX_ATTEMPTS it becomes FAILED
     * and needs a manual retry. Records created before this field existed
     * were only ever written after a successful push, hence the SYNCED default.
     */
    syncStatus: { type: String, enum: Object.values(ShopfaSyncStatus), default: ShopfaSyncStatus.SYNCED, index: true },
    syncAttempts: { type: Number, default: 0 },
    lastSyncError: { type: String, default: null },
    nextSyncAt: { type: Date, default: null },
    syncedAt: { type: Date, default: null },
    /** Actor of the send, reused for the status-change audit entry when a background retry is what finally syncs. */
    sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Denormalized alongside `sentBy` so history displays the staff name without a User lookup/populate on every list read. */
    sentByName: { type: String, default: null },
    sentAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

packingRecordSchema.index({ sentAt: -1 });

export type PackingRecordSchemaType = InferSchemaType<typeof packingRecordSchema>;
export type PackingRecordDocument = HydratedDocument<PackingRecordSchemaType> & { _id: Types.ObjectId };
export const PackingRecordModel = model("PackingRecord", packingRecordSchema);
