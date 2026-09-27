import { Router } from "express";
import * as settingsController from "../controllers/settingsController";

/**
 * Read-only, system-wide config for any authenticated user -- unlike
 * /settings, which is guarded by the Settings permission.
 */
export const appConfigRoutes = Router();

appConfigRoutes.get("/", settingsController.getAppConfig);
