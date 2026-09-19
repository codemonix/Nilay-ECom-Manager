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
    statusCodeAfterSend: { type: Number, required: true },
    statusTitleAfterSend: { type: String, required: true },
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
