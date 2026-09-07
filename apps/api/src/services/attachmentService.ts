import path from "path";
import { CaseEventType } from "@complaint-system/shared";
import { attachmentRepository } from "../repositories/attachmentRepository";
import { recordEvent, type Actor } from "./caseService";
import { UPLOAD_ROOT } from "../middleware/upload";

export async function addAttachment(
  caseId: string,
  file: Express.Multer.File,
  actor: Actor | undefined,
) {
  const attachment = await attachmentRepository.create({
    caseId,
    originalFilename: file.originalname,
    storedFilename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: path.relative(UPLOAD_ROOT, file.path),
    uploadedBy: actor?.id ?? null,
  });

  await recordEvent(caseId, CaseEventType.ATTACHMENT_ADDED, actor, file.originalname, {
    attachmentId: String(attachment._id),
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });

  return attachment;
}

export async function listAttachments(caseId: string) {
  return attachmentRepository.findByCaseId(caseId);
}
