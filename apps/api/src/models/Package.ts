import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import { PACKAGE_STATUS_VALUES, PackageStatus } from "@complaint-system/shared";

const packageItemSchema = new Schema(
  {
    photoAttachmentId: { type: Schema.Types.ObjectId, ref: "Attachment", default: null },
    description: { type: String, trim: true, default: "" },
    // Free-text variant label (e.g. a ring/bangle size) -- each variant is
    // its own item row with its own photo/quantity/price/match, not a
    // nested sub-structure (there is no shared parent "product" entity).
    variantLabel: { type: String, trim: true, default: null },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "IRR" },

    productCode: { type: String, default: null, trim: true },
    shopfaProductId: { type: String, default: null },
    sku: { type: String, default: null },
    matchedProductTitle: { type: String, default: null },
    matchedProductImageUrl: { type: String, default: null },
    // Shopfa's own convention for this jewelry store: a title ending in "*"
    // signals something to the (not-yet-built) Inventory module about stock
    // state. We only detect and record it here -- see inventoryPending.
    titleEndsWithAsterisk: { type: Boolean, default: false },
    // Set true once matched; stays true until the Inventory module exists
    // and decides whether/how to update Shopfa's stock level or title. This
    // module does not act on it -- it only flags it for that later step.
    inventoryPending: { type: Boolean, default: false },
    matchedAt: { type: Date, default: null },
    matchedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Shopfa's own stock count at the moment of matching, so the UI can
    // suggest the count Shopfa should be updated to (this + what was
    // received) until the Inventory module can push that update itself.
    matchedAvailableQuantity: { type: Number, default: null },

    // Actual count confirmed by the Receiving module once the package
    // arrives at its destination -- distinct from `quantity` (what was
    // purchased/expected). Null until the receiving user counts it.
    receivedQuantity: { type: Number, default: null, min: 0 },

    loggedAt: { type: Date, required: true, default: () => new Date() },
    loggedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: null },
  },
  { timestamps: false }, // default _id:true so items are individually addressable
);

const packageSchema = new Schema(
  {
    packageNumber: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: PACKAGE_STATUS_VALUES,
      required: true,
      default: PackageStatus.DRAFT,
    },
    // Free text -- there is no supplier/vendor entity anywhere in this codebase.
    supplierName: { type: String, trim: true, default: null },
    items: { type: [packageItemSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // Set exclusively by the Receiving module's confirmReceived action when
    // status moves in_progress -> completed; never set by a purchasing user.
    receivedAt: { type: Date, default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    lastActivityAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

packageSchema.index({ status: 1, lastActivityAt: -1 });
packageSchema.index({ createdAt: -1 });

export type PackageSchemaType = InferSchemaType<typeof packageSchema>;
export type PackageDocument = HydratedDocument<PackageSchemaType> & { _id: Types.ObjectId };
export type PackageItemSchemaType = InferSchemaType<typeof packageItemSchema>;
export type PackageItemSubdocument = PackageDocument["items"][number];
export const PackageModel = model("Package", packageSchema);
