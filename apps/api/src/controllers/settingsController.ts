import type { Request, Response } from "express";
import type { DataSource, SystemLogLevel } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import * as settingsService from "../services/settingsService";
import * as orderImportService from "../services/orderImportService";
import * as backupService from "../services/backupService";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  return sendSuccess(res, settings);
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

export const backupSettings = asyncHandler(async (_req: Request, res: Response) => {
  const backup = await backupService.createSettingsBackup();
  res.setHeader("Content-Disposition", "attachment; filename=settings-backup.json");
  return res.json(backup);
});

export const restoreSettings = asyncHandler(async (req: Request, res: Response) => {
  await backupService.restoreSettingsBackup(req.body);
  return sendSuccess(res, { restored: true });
});

export const backupData = asyncHandler(async (_req: Request, res: Response) => {
  const backup = await backupService.createDataBackup();
  res.setHeader("Content-Disposition", "attachment; filename=system-data-backup.json");
  return res.json(backup);
});

export const restoreData = asyncHandler(async (req: Request, res: Response) => {
  await backupService.restoreDataBackup(req.body);
  return sendSuccess(res, { restored: true });
});
