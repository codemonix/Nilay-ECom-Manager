import { Router } from "express";
import * as orderPrecheckController from "../controllers/orderPrecheckController";
import { validate } from "../middleware/validate";
import {
  listOrderPrecheckQuerySchema,
  orderNumberParamSchema,
  saveOrderPrecheckSchema,
} from "../validators/orderPrecheckValidators";

export const orderPrecheckRoutes = Router();

orderPrecheckRoutes.get(
  "/orders",
  validate(listOrderPrecheckQuerySchema, "query"),
  orderPrecheckController.listOrders,
);

orderPrecheckRoutes.post(
  "/orders/:orderNumber/save",
  validate(orderNumberParamSchema, "params"),
  validate(saveOrderPrecheckSchema),
  orderPrecheckController.saveOrder,
);
