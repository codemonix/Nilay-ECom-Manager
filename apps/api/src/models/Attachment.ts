import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import { ATTACHMENT_SUBJECT_TYPE_VALUES } from "@complaint-system/shared";

/**
 * Storage is abstracted behind `storageProvider` + `path`. V1 uses "local"
 * disk storage under UPLOAD_DIR; switching to S3 later only requires adding
 * a new provider value and an integrations/storage adapter -- no schema change.
 *
 * `subjectType`/`subjectId` is a polymorphic reference (Case or Package
 * today) rather than a dedicated `caseId`, so any future module can reuse
 * the same attachment/upload pipeline without a new collection.
 */
const attachmentSchema = new Schema(
  {
    subjectType: { type: String, enum: ATTACHMENT_SUBJECT_TYPE_VALUES, required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
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

attachmentSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });

export type AttachmentSchemaType = InferSchemaType<typeof attachmentSchema>;
export type AttachmentDocument = HydratedDocument<AttachmentSchemaType> & { _id: Types.ObjectId };
export const AttachmentModel = model("Attachment", attachmentSchema);
