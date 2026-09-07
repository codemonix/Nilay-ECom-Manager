import { Router } from "express";
import * as logController from "../controllers/logController";
import { validate } from "../middleware/validate";
import {
  listSystemLogsQuerySchema,
  listUserActivityLogsQuerySchema,
  listShopfaTransactionLogsQuerySchema,
} from "../validators/logValidators";

export const logRoutes = Router();

logRoutes.get("/system", validate(listSystemLogsQuerySchema, "query"), logController.listSystemLogs);
logRoutes.get("/user-activity", validate(listUserActivityLogsQuerySchema, "query"), logController.listUserActivityLogs);
logRoutes.get(
  "/shopfa-transactions",
  validate(listShopfaTransactionLogsQuerySchema, "query"),
  logController.listShopfaTransactionLogs,
);
