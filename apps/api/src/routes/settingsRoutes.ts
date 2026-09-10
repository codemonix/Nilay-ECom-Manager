import { Router } from "express";
import * as settingsController from "../controllers/settingsController";
import { validate } from "../middleware/validate";
import { uploadOrdersFile } from "../middleware/upload";
import { updateDataSourceSchema, updateSystemLogLevelSchema } from "../validators/settingsValidators";

export const settingsRoutes = Router();

settingsRoutes.get("/", settingsController.getSettings);
settingsRoutes.patch("/data-source", validate(updateDataSourceSchema), settingsController.updateDataSource);
settingsRoutes.patch(
  "/log-level",
  validate(updateSystemLogLevelSchema),
  settingsController.updateSystemLogLevel,
);
settingsRoutes.get("/log-sizes", settingsController.getLogSizes);
settingsRoutes.post("/shopfa/test-connection", settingsController.testShopfaConnection);
settingsRoutes.post("/orders/import", uploadOrdersFile.single("file"), settingsController.importOrders);
settingsRoutes.get("/backup", settingsController.backupSettings);
settingsRoutes.post("/restore", settingsController.restoreSettings);
settingsRoutes.get("/data-backup", settingsController.backupData);
settingsRoutes.post("/data-restore", settingsController.restoreData);
