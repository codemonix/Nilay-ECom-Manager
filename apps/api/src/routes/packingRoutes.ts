import { Router } from "express";
import * as packingController from "../controllers/packingController";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import { idParamSchema } from "../validators/commonValidators";
import {
  listPackingHistoryQuerySchema,
  packingCustomerOrdersQuerySchema,
  listPackingQuerySchema,
  sendPackedOrdersSchema,
} from "../validators/packingValidators";

export const packingRoutes = Router();

/** Generous cap on confirmation photos per customer group -- a guard against runaway uploads, not a business limit. */
const MAX_PHOTOS_PER_SEND = 10;

packingRoutes.get("/orders", validate(listPackingQuerySchema, "query"), packingController.listOrders);

/** Opening a customer group: the customer's orders in other statuses, for information. */
packingRoutes.get("/customer-orders", validate(packingCustomerOrdersQuerySchema, "query"), packingController.getCustomerOrders);

/** Retry pushing a packed order to Shopfa now (its automatic retries may still be pending, or have given up). */
packingRoutes.post("/records/:id/retry-sync", validate(idParamSchema, "params"), packingController.retrySync);

packingRoutes.post(
  "/send",
  upload.array("photos", MAX_PHOTOS_PER_SEND),
  validate(sendPackedOrdersSchema),
  packingController.sendOrders,
);

packingRoutes.get("/history", validate(listPackingHistoryQuerySchema, "query"), packingController.listHistory);
