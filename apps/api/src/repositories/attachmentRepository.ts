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
};
