import { Router } from "express";
import * as ordersByStatusController from "../controllers/ordersByStatusController";
import { validate } from "../middleware/validate";
import { ordersByStatusQuerySchema } from "../validators/ordersByStatusValidators";

export const ordersByStatusRoutes = Router();

ordersByStatusRoutes.get("/orders", validate(ordersByStatusQuerySchema, "query"), ordersByStatusController.listOrders);
