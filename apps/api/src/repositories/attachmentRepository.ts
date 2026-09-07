import { AttachmentModel, type AttachmentDocument } from "../models/Attachment";

export interface CreateAttachmentData {
  caseId: string;
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

  async findByCaseId(caseId: string): Promise<AttachmentDocument[]> {
    return AttachmentModel.find({ caseId }).sort({ createdAt: -1 });
  },
};
