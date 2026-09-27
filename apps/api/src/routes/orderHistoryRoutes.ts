import { Router } from "express";
import * as orderHistoryController from "../controllers/orderHistoryController";
import { validate } from "../middleware/validate";
import { orderNumberParamSchema } from "../validators/orderPrecheckValidators";

export const orderHistoryRoutes = Router();

/** Status changes this system made to the order, plus its packing passes (pictures and Shopfa sync state). */
orderHistoryRoutes.get("/:orderNumber", validate(orderNumberParamSchema, "params"), orderHistoryController.getHistory);
