import type { AttachmentSubjectType } from "@complaint-system/shared";
import { AttachmentModel, type AttachmentDocument } from "../models/Attachment";

export interface CreateAttachmentData {
  subjectType: AttachmentSubjectType;
  subjectId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedBy?: string | null;
}

export const attachmentRepository = {
  async create(data: CreateAttachmentData): Promise<AttachmentDocument> {
    return AttachmentModel.create(data);
  },

  async findBySubject(subjectType: AttachmentSubjectType, subjectId: string): Promise<AttachmentDocument[]> {
    return AttachmentModel.find({ subjectType, subjectId }).sort({ createdAt: -1 });
  },

  /** Batched form of findBySubject for a page of subjects at once (e.g. Packing history's list view), avoiding one query per row. */
  async findBySubjectIds(subjectType: AttachmentSubjectType, subjectIds: string[]): Promise<AttachmentDocument[]> {
    if (subjectIds.length === 0) return [];
    return AttachmentModel.find({ subjectType, subjectId: { $in: subjectIds } }).sort({ createdAt: -1 });
  },
};
