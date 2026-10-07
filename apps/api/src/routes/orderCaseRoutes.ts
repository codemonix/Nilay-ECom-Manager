import { Router } from "express";
import * as orderCaseController from "../controllers/orderCaseController";
import { validate } from "../middleware/validate";
import { orderNumberParamSchema } from "../validators/orderPrecheckValidators";
import { createOrderCaseSchema } from "../validators/orderCaseValidators";

export const orderCaseRoutes = Router();

/** The order's items and already-open cases, for the "create case" dialog on the order screens. */
orderCaseRoutes.get("/:orderNumber", validate(orderNumberParamSchema, "params"), orderCaseController.getContext);
/** Opens a case against the order and puts it in "در حال پیگیری". */
orderCaseRoutes.post(
  "/:orderNumber",
  validate(orderNumberParamSchema, "params"),
  validate(createOrderCaseSchema),
  orderCaseController.createCase,
);
