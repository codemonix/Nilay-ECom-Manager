import { Router } from "express";
import * as purchasingOverviewController from "../controllers/purchasingOverviewController";

export const purchasingOverviewRoutes = Router();

purchasingOverviewRoutes.get("/", purchasingOverviewController.getOverview);
