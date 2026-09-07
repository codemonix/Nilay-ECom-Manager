import { Router } from "express";
import * as orderController from "../controllers/orderController";
import { validate } from "../middleware/validate";
import { listOrdersQuerySchema } from "../validators/orderValidators";

export const orderRoutes = Router();

orderRoutes.get("/", validate(listOrdersQuerySchema, "query"), orderController.listOrders);
orderRoutes.get("/:externalOrderId", orderController.getOrder);
