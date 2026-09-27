import { Router } from "express";
import * as settingsController from "../controllers/settingsController";
import { validate } from "../middleware/validate";
import { uploadOrdersFile } from "../middleware/upload";
import { requireRole } from "../middleware/authenticate";
import { StaffRole } from "@complaint-system/shared";
import {
  updateDataSourceSchema,
  updateSessionSettingsSchema,
  updateSystemLogLevelSchema,
} from "../validators/settingsValidators";

export const settingsRoutes = Router();

settingsRoutes.get("/", settingsController.getSettings);
settingsRoutes.patch("/data-source", validate(updateDataSourceSchema), settingsController.updateDataSource);
settingsRoutes.patch(
  "/log-level",
  validate(updateSystemLogLevelSchema),
  settingsController.updateSystemLogLevel,
);
// Session lifetimes are a security control, so they stay admin-only even
// for staff who have been granted the Settings menu.
settingsRoutes.patch(
  "/session",
  requireRole(StaffRole.ADMIN),
  validate(updateSessionSettingsSchema),
  settingsController.updateSessionSettings,
);
settingsRoutes.get("/log-sizes", settingsController.getLogSizes);
settingsRoutes.post("/shopfa/test-connection", settingsController.testShopfaConnection);
settingsRoutes.post("/orders/import", uploadOrdersFile.single("file"), settingsController.importOrders);
settingsRoutes.get("/backup", settingsController.backupSettings);
settingsRoutes.post("/restore", settingsController.restoreSettings);
settingsRoutes.get("/data-backup", settingsController.backupData);
settingsRoutes.post("/data-restore", settingsController.restoreData);
