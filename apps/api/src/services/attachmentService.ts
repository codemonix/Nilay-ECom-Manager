import path from "path";
import type { AttachmentSubjectType } from "@complaint-system/shared";
import { attachmentRepository } from "../repositories/attachmentRepository";
import { UPLOAD_ROOT } from "../middleware/upload";
import type { AttachmentDocument } from "../models/Attachment";

export interface AttachmentActor {
  id: string;
  name: string;
}

/**
 * Generic attachment upload, shared by any feature (Case, Package, ...) that
 * needs to attach a file. `onRecorded` lets the caller append its own
 * subject-specific audit event (e.g. caseService.recordEvent /
 * packageService's equivalent) without this module having to import every
 * feature's service directly.
 */
export async function addAttachment(
  subjectType: AttachmentSubjectType,
  subjectId: string,
  file: Express.Multer.File,
  actor: AttachmentActor | undefined,
  onRecorded?: (attachment: AttachmentDocument) => Promise<void>,
): Promise<AttachmentDocument> {
  const attachment = await attachmentRepository.create({
    subjectType,
    subjectId,
    originalFilename: file.originalname,
    storedFilename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: path.relative(UPLOAD_ROOT, file.path),
    uploadedBy: actor?.id ?? null,
  });

  if (onRecorded) await onRecorded(attachment);

  return attachment;
}

export async function listAttachments(
  subjectType: AttachmentSubjectType,
  subjectId: string,
): Promise<AttachmentDocument[]> {
  return attachmentRepository.findBySubject(subjectType, subjectId);
}

export async function listAttachmentsBySubjectIds(
  subjectType: AttachmentSubjectType,
  subjectIds: string[],
): Promise<AttachmentDocument[]> {
  return attachmentRepository.findBySubjectIds(subjectType, subjectIds);
}
