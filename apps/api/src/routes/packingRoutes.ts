import { Router } from "express";
import * as packingController from "../controllers/packingController";
import { validate } from "../middleware/validate";
import { listPackingQuerySchema, orderNumberParamSchema } from "../validators/packingValidators";

export const packingRoutes = Router();

packingRoutes.get("/orders", validate(listPackingQuerySchema, "query"), packingController.listOrders);

packingRoutes.post(
  "/orders/:orderNumber/send",
  validate(orderNumberParamSchema, "params"),
  packingController.sendOrder,
);
