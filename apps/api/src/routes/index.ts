import { Router } from "express";
import { MenuKey } from "@complaint-system/shared";
import { authRoutes } from "./authRoutes";
import { caseRoutes } from "./caseRoutes";
import { customerRoutes } from "./customerRoutes";
import { userRoutes } from "./userRoutes";
import { healthRoutes } from "./healthRoutes";
import { settingsRoutes } from "./settingsRoutes";
import { orderRoutes } from "./orderRoutes";
import { logRoutes } from "./logRoutes";
import { requireAuth, requirePermission } from "../middleware/authenticate";

export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/cases", requireAuth, requirePermission(MenuKey.CASES), caseRoutes);
apiRouter.use("/customers", requireAuth, requirePermission(MenuKey.CASES), customerRoutes);
apiRouter.use("/users", requireAuth, userRoutes);
apiRouter.use("/settings", requireAuth, requirePermission(MenuKey.SETTINGS), settingsRoutes);
apiRouter.use("/orders", requireAuth, requirePermission(MenuKey.SETTINGS), orderRoutes);
apiRouter.use("/logs", requireAuth, requirePermission(MenuKey.LOGS), logRoutes);
