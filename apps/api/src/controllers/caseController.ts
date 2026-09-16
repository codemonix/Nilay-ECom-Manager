import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { serializeAttachment, serializeCase, serializeCaseEvent } from "../utils/serializers";
import { ApiError } from "../utils/ApiError";
import * as caseService from "../services/caseService";
import * as attachmentService from "../services/attachmentService";
import type {
  CreateCaseInput,
  ListCasesQuery,
} from "../validators/caseValidators";
import {
  AttachmentSubjectType,
  CaseEventType,
  type CaseContactPoint,
  type CasePriority,
  type CaseStatus,
} from "@complaint-system/shared";

export const listCases = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListCasesQuery;
  const result = await caseService.listCases(query);
  return sendSuccess(res, result.items.map(serializeCase), 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const createCase = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateCaseInput;
  const { case: caseDoc } = await caseService.createCase(input, req.currentUser);
  return sendCreated(res, serializeCase(caseDoc));
});

export const getCase = asyncHandler(async (req: Request, res: Response) => {
  const caseDoc = await caseService.getCaseById(req.params.id as string);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const getTimeline = asyncHandler(async (req: Request, res: Response) => {
  const events = await caseService.getTimeline(req.params.id as string);
  return sendSuccess(res, events.map(serializeCaseEvent));
});

export const addNoteEvent = asyncHandler(async (req: Request, res: Response) => {
  const { body, visibility } = req.body as { body: string; visibility: "internal" | "customer" };
  const { case: caseDoc } = await caseService.addNote(req.params.id as string, body, visibility, req.currentUser);
  return sendCreated(res, serializeCase(caseDoc));
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, reason } = req.body as { status: CaseStatus; reason?: string };
  const { case: caseDoc } = await caseService.changeStatus(req.params.id as string, status, reason, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const changePriority = asyncHandler(async (req: Request, res: Response) => {
  const { priority } = req.body as { priority: CasePriority };
  const { case: caseDoc } = await caseService.changePriority(req.params.id as string, priority, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const changeContactPoint = asyncHandler(async (req: Request, res: Response) => {
  const { contactPoint } = req.body as { contactPoint: CaseContactPoint };
  const { case: caseDoc } = await caseService.changeContactPoint(
    req.params.id as string,
    contactPoint,
    req.currentUser,
  );
  return sendSuccess(res, serializeCase(caseDoc));
});

export const assignCase = asyncHandler(async (req: Request, res: Response) => {
  const { assignedTo } = req.body as { assignedTo: string | null };
  const { case: caseDoc } = await caseService.assignCase(req.params.id as string, assignedTo, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const linkOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = req.body as { externalOrderId: string; orderNumber: string };
  const { case: caseDoc } = await caseService.linkOrder(req.params.id as string, order, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const linkItem = asyncHandler(async (req: Request, res: Response) => {
  const item = req.body as { externalItemId: string; sku: string; title: string };
  const { case: caseDoc } = await caseService.linkItem(req.params.id as string, item, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const addTag = asyncHandler(async (req: Request, res: Response) => {
  const { tag } = req.body as { tag: string };
  const { case: caseDoc } = await caseService.addTag(req.params.id as string, tag, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const removeTag = asyncHandler(async (req: Request, res: Response) => {
  const { tag } = req.body as { tag: string };
  const { case: caseDoc } = await caseService.removeTag(req.params.id as string, tag, req.currentUser);
  return sendSuccess(res, serializeCase(caseDoc));
});

export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const caseId = req.params.id as string;
  const file = req.file;
  const attachment = await attachmentService.addAttachment(
    AttachmentSubjectType.CASE,
    caseId,
    file,
    req.currentUser,
    (att) =>
      caseService
        .recordEvent(caseId, CaseEventType.ATTACHMENT_ADDED, req.currentUser, file.originalname, {
          attachmentId: String(att._id),
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        })
        .then(() => undefined),
  );
  return sendCreated(res, serializeAttachment(attachment));
});

export const listAttachments = asyncHandler(async (req: Request, res: Response) => {
  const attachments = await attachmentService.listAttachments(AttachmentSubjectType.CASE, req.params.id as string);
  return sendSuccess(res, attachments.map(serializeAttachment));
});
