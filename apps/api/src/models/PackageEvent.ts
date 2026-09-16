import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import { PACKAGE_EVENT_TYPE_VALUES } from "@complaint-system/shared";

/**
 * PackageEvents are append-only, mirroring CaseEvent -- no update/delete
 * routes are exposed for this collection on purpose, it is the authoritative
 * operational history the Purchasing Overview dashboard aggregates over.
 */
const packageEventSchema = new Schema(
  {
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },
    type: { type: String, enum: PACKAGE_EVENT_TYPE_VALUES, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    body: { type: String, default: null },
    data: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

packageEventSchema.index({ packageId: 1, createdAt: 1 });

export type PackageEventSchemaType = InferSchemaType<typeof packageEventSchema>;
export type PackageEventDocument = HydratedDocument<PackageEventSchemaType> & { _id: Types.ObjectId };
export const PackageEventModel = model("PackageEvent", packageEventSchema);
