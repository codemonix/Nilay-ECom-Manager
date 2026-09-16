import type { Request, Response } from "express";
import { AttachmentSubjectType, PackageEventType, type PackageStatus } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { serializeAttachment, serializePackage, serializePackageEvent } from "../utils/serializers";
import { ApiError } from "../utils/ApiError";
import * as packageService from "../services/packageService";
import * as attachmentService from "../services/attachmentService";
import type {
  ChangePackageStatusInput,
  CreateDraftPackageInput,
  ListPackagesQuery,
  MatchItemInput,
  ReceiveItemInput,
  UpdateItemInput,
} from "../validators/packageValidators";

export const listPackages = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListPackagesQuery;
  const result = await packageService.listPackages(query);
  return sendSuccess(res, result.items.map(serializePackage), 200, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const createDraftPackage = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateDraftPackageInput;
  const { package: packageDoc } = await packageService.createDraftPackage(input, req.currentUser);
  return sendCreated(res, serializePackage(packageDoc));
});

/** Resolves (or creates) the single shared open Draft package used by the Receive Items flow. */
export const getOpenDraftPackage = asyncHandler(async (req: Request, res: Response) => {
  const packageDoc = await packageService.getOrCreateOpenDraft(req.currentUser);
  return sendSuccess(res, serializePackage(packageDoc));
});

export const getPackage = asyncHandler(async (req: Request, res: Response) => {
  const packageDoc = await packageService.getPackageById(req.params.id as string);
  return sendSuccess(res, serializePackage(packageDoc));
});

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await packageService.getEvents(req.params.id as string);
  return sendSuccess(res, events.map(serializePackageEvent));
});

/** A photo is mandatory for every purchased item -- see ItemCaptureStep on the frontend for the matching client-side gate. */
export const receiveItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("A photo is required to add an item");
  const packageId = req.params.id as string;
  const input = req.body as ReceiveItemInput;
  const attachment = await attachmentService.addAttachment(
    AttachmentSubjectType.PACKAGE,
    packageId,
    req.file,
    req.currentUser,
  );
  const { package: packageDoc } = await packageService.receiveItem(
    packageId,
    input,
    String(attachment._id),
    req.currentUser,
  );
  return sendCreated(res, serializePackage(packageDoc));
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateItemInput;
  const { package: packageDoc } = await packageService.updateItem(
    req.params.id as string,
    req.params.itemId as string,
    input,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { package: packageDoc } = await packageService.removeItem(
    req.params.id as string,
    req.params.itemId as string,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

/** Read-only Shopfa lookup shown to the user before they confirm the match -- see packageService.previewMatch. */
export const previewMatchItem = asyncHandler(async (req: Request, res: Response) => {
  const { productCode } = req.body as MatchItemInput;
  const preview = await packageService.previewMatch(req.params.id as string, req.params.itemId as string, productCode);
  return sendSuccess(res, preview);
});

export const matchItem = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as MatchItemInput;
  const { package: packageDoc } = await packageService.matchItem(
    req.params.id as string,
    req.params.itemId as string,
    input,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

export const unmatchItem = asyncHandler(async (req: Request, res: Response) => {
  const { package: packageDoc } = await packageService.unmatchItem(
    req.params.id as string,
    req.params.itemId as string,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, reason } = req.body as ChangePackageStatusInput;
  const { package: packageDoc } = await packageService.changeStatus(
    req.params.id as string,
    status as PackageStatus,
    reason,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const packageId = req.params.id as string;
  const file = req.file;
  const attachment = await attachmentService.addAttachment(
    AttachmentSubjectType.PACKAGE,
    packageId,
    file,
    req.currentUser,
    (att) =>
      packageService
        .recordEvent(packageId, PackageEventType.ATTACHMENT_ADDED, req.currentUser, file.originalname, {
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
  const attachments = await attachmentService.listAttachments(AttachmentSubjectType.PACKAGE, req.params.id as string);
  return sendSuccess(res, attachments.map(serializeAttachment));
});
