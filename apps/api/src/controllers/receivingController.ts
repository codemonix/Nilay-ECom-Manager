import type { Request, Response } from "express";
import { AttachmentSubjectType } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { serializeAttachment, serializePackage, serializePackageEvent } from "../utils/serializers";
import * as packageService from "../services/packageService";
import * as attachmentService from "../services/attachmentService";
import type { ListPackagesQuery } from "../validators/packageValidators";
import type { ConfirmReceivedInput, UpdateReceivedQuantityInput } from "../validators/receivingValidators";

/**
 * Thin, read/mutate surface over the same Package aggregate Purchasing
 * owns, gated by its own MenuKey.RECEIVING permission rather than
 * MenuKey.PURCHASING -- a different role confirms what physically arrived
 * than the one who assembled the package, per docs/future-modules.md's
 * "same model, different permission-gated entry point" pattern.
 */
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

export const getPackage = asyncHandler(async (req: Request, res: Response) => {
  const packageDoc = await packageService.getPackageById(req.params.id as string);
  return sendSuccess(res, serializePackage(packageDoc));
});

export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await packageService.getEvents(req.params.id as string);
  return sendSuccess(res, events.map(serializePackageEvent));
});

/** Read-only -- lets the receiving user compare the purchase photo against the (if matched) Shopfa product image on the package's items. */
export const listAttachments = asyncHandler(async (req: Request, res: Response) => {
  const attachments = await attachmentService.listAttachments(AttachmentSubjectType.PACKAGE, req.params.id as string);
  return sendSuccess(res, attachments.map(serializeAttachment));
});

export const updateReceivedQuantity = asyncHandler(async (req: Request, res: Response) => {
  const { receivedQuantity } = req.body as UpdateReceivedQuantityInput;
  const { package: packageDoc } = await packageService.updateReceivedQuantity(
    req.params.id as string,
    req.params.itemId as string,
    receivedQuantity,
    req.currentUser,
  );
  return sendSuccess(res, serializePackage(packageDoc));
});

export const confirmReceived = asyncHandler(async (req: Request, res: Response) => {
  const { markAllComplete } = req.body as ConfirmReceivedInput;
  const { package: packageDoc } = await packageService.confirmReceived(req.params.id as string, req.currentUser, {
    markAllComplete,
  });
  return sendSuccess(res, serializePackage(packageDoc));
});
