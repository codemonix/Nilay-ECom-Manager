import { Router } from "express";
import { caseRoutes } from "./caseRoutes";
import { customerRoutes } from "./customerRoutes";
import { userRoutes } from "./userRoutes";
import { healthRoutes } from "./healthRoutes";

export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/cases", caseRoutes);
apiRouter.use("/customers", customerRoutes);
apiRouter.use("/users", userRoutes);
