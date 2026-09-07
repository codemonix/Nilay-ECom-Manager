import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";

/**
 * Storage is abstracted behind `storageProvider` + `path`. V1 uses "local"
 * disk storage under UPLOAD_DIR; switching to S3 later only requires adding
 * a new provider value and an integrations/storage adapter -- no schema change.
 */
const attachmentSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageProvider: { type: String, enum: ["local"], default: "local" },
    path: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

attachmentSchema.index({ caseId: 1, createdAt: -1 });

export type AttachmentSchemaType = InferSchemaType<typeof attachmentSchema>;
export type AttachmentDocument = HydratedDocument<AttachmentSchemaType> & { _id: Types.ObjectId };
export const AttachmentModel = model("Attachment", attachmentSchema);
