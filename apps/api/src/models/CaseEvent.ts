import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import { CASE_EVENT_TYPE_VALUES } from "@complaint-system/shared";

/**
 * CaseEvents are append-only. No update/delete routes are exposed for this
 * collection on purpose -- it is the authoritative operational history that
 * future analytics (module 9/10) will aggregate over.
 */
const caseEventSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    type: { type: String, enum: CASE_EVENT_TYPE_VALUES, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    body: { type: String, default: null },
    data: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

caseEventSchema.index({ caseId: 1, createdAt: 1 });

export type CaseEventSchemaType = InferSchemaType<typeof caseEventSchema>;
export type CaseEventDocument = HydratedDocument<CaseEventSchemaType> & { _id: Types.ObjectId };
export const CaseEventModel = model("CaseEvent", caseEventSchema);
