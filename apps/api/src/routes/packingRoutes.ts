import { Router } from "express";
import * as packingController from "../controllers/packingController";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import {
  listPackingHistoryQuerySchema,
  listPackingQuerySchema,
  orderNumberParamSchema,
  sendPackedOrderSchema,
} from "../validators/packingValidators";

export const packingRoutes = Router();

packingRoutes.get("/orders", validate(listPackingQuerySchema, "query"), packingController.listOrders);

packingRoutes.post(
  "/orders/:orderNumber/send",
  validate(orderNumberParamSchema, "params"),
  upload.single("photo"),
  validate(sendPackedOrderSchema),
  packingController.sendOrder,
);

packingRoutes.get("/history", validate(listPackingHistoryQuerySchema, "query"), packingController.listHistory);
