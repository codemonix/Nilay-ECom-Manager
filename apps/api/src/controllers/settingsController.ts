import type { Request, Response } from "express";
import { SecurityEventType, type DataSource, type SystemLogLevel } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import * as settingsService from "../services/settingsService";
import * as orderImportService from "../services/orderImportService";
import * as backupService from "../services/backupService";
import * as securityEventService from "../services/securityEventService";
import type { UpdateSessionSettingsInput, UpdateUploadSettingsInput } from "../validators/settingsValidators";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  return sendSuccess(res, settings);
});

export const getAppConfig = asyncHandler(async (_req: Request, res: Response) => {
  const config = await settingsService.getAppConfig();
  return sendSuccess(res, config);
});

export const updateDataSource = asyncHandler(async (req: Request, res: Response) => {
  const { dataSource } = req.body as { dataSource: DataSource };
  const settings = await settingsService.setDataSource(dataSource);
  return sendSuccess(res, settings);
});

export const updateSystemLogLevel = asyncHandler(async (req: Request, res: Response) => {
  const { systemLogLevel } = req.body as { systemLogLevel: SystemLogLevel };
  const settings = await settingsService.setSystemLogLevel(systemLogLevel);
  return sendSuccess(res, settings);
});

export const updateSessionSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.setSessionTtls(req.body as UpdateSessionSettingsInput);
  securityEventService.record(req, SecurityEventType.SESSION_SETTINGS_CHANGED, { details: { changes: req.body } });
  return sendSuccess(res, settings);
});

export const updateUploadSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.setMaxImageUploadSize(req.body as UpdateUploadSettingsInput);
  return sendSuccess(res, settings);
});

export const getLogSizes = asyncHandler(async (_req: Request, res: Response) => {
  const sizes = await settingsService.getLogSizes();
  return sendSuccess(res, sizes);
});

export const testShopfaConnection = asyncHandler(async (_req: Request, res: Response) => {
  const result = await settingsService.testShopfaConnection();
  return sendSuccess(res, result);
});

export const importOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const result = await orderImportService.importXlsxFile(
    req.file.buffer,
    req.file.originalname,
    req.currentUser,
  );
  return sendSuccess(res, result);
});

export const backupSettings = asyncHandler(async (req: Request, res: Response) => {
  const backup = await backupService.createSettingsBackup();
  securityEventService.record(req, SecurityEventType.SETTINGS_BACKUP_DOWNLOADED);
  res.setHeader("Content-Disposition", "attachment; filename=settings-backup.json");
  return res.json(backup);
});

export const restoreSettings = asyncHandler(async (req: Request, res: Response) => {
  await backupService.restoreSettingsBackup(req.body);
  securityEventService.record(req, SecurityEventType.SETTINGS_RESTORED);
  return sendSuccess(res, { restored: true });
});

export const backupData = asyncHandler(async (req: Request, res: Response) => {
  const backup = await backupService.createDataBackup();
  securityEventService.record(req, SecurityEventType.DATA_BACKUP_DOWNLOADED);
  res.setHeader("Content-Disposition", "attachment; filename=system-data-backup.json");
  return res.json(backup);
});

export const restoreData = asyncHandler(async (req: Request, res: Response) => {
  await backupService.restoreDataBackup(req.body);
  securityEventService.record(req, SecurityEventType.DATA_RESTORED);
  return sendSuccess(res, { restored: true });
});
