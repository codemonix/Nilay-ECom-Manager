import { Router } from "express";
import * as reportingController from "../controllers/reportingController";
import { validate } from "../middleware/validate";
import { shortageReportQuerySchema } from "../validators/reportingValidators";

export const reportingRoutes = Router();

reportingRoutes.get(
  "/shortage",
  validate(shortageReportQuerySchema, "query"),
  reportingController.getShortageReport,
);
