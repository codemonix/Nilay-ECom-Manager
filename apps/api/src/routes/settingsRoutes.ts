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
  updateUploadSettingsSchema,
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
settingsRoutes.patch("/uploads", validate(updateUploadSettingsSchema), settingsController.updateUploadSettings);
settingsRoutes.get("/log-sizes", settingsController.getLogSizes);
settingsRoutes.post("/shopfa/test-connection", settingsController.testShopfaConnection);
settingsRoutes.post("/orders/import", uploadOrdersFile.single("file"), settingsController.importOrders);
// A data backup carries every user's password hash, and a restore replaces
// the users collection wholesale (i.e. can mint an admin account), so both
// directions are admin-only even for staff granted the Settings menu.
const adminOnly = requireRole(StaffRole.ADMIN);
settingsRoutes.get("/backup", adminOnly, settingsController.backupSettings);
settingsRoutes.post("/restore", adminOnly, settingsController.restoreSettings);
settingsRoutes.get("/data-backup", adminOnly, settingsController.backupData);
settingsRoutes.post("/data-restore", adminOnly, settingsController.restoreData);
