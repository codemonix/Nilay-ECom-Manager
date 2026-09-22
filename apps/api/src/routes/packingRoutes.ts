import { Router } from "express";
import * as packingController from "../controllers/packingController";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import {
  listPackingHistoryQuerySchema,
  listPackingQuerySchema,
  sendPackedOrdersSchema,
} from "../validators/packingValidators";

export const packingRoutes = Router();

/** Generous cap on confirmation photos per customer group -- a guard against runaway uploads, not a business limit. */
const MAX_PHOTOS_PER_SEND = 10;

packingRoutes.get("/orders", validate(listPackingQuerySchema, "query"), packingController.listOrders);

packingRoutes.post(
  "/send",
  upload.array("photos", MAX_PHOTOS_PER_SEND),
  validate(sendPackedOrdersSchema),
  packingController.sendOrders,
);

packingRoutes.get("/history", validate(listPackingHistoryQuerySchema, "query"), packingController.listHistory);
