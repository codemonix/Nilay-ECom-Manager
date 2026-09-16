import { Router } from "express";
import * as receivingController from "../controllers/receivingController";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../validators/commonValidators";
import { packageItemParamsSchema } from "../validators/packageValidators";
import {
  confirmReceivedSchema,
  listReceivingPackagesQuerySchema,
  updateReceivedQuantitySchema,
} from "../validators/receivingValidators";

export const receivingRoutes = Router();

receivingRoutes.get("/", validate(listReceivingPackagesQuerySchema, "query"), receivingController.listPackages);
receivingRoutes.get("/:id", validate(idParamSchema, "params"), receivingController.getPackage);
receivingRoutes.get("/:id/events", validate(idParamSchema, "params"), receivingController.getEvents);
receivingRoutes.get("/:id/attachments", validate(idParamSchema, "params"), receivingController.listAttachments);

receivingRoutes.patch(
  "/:id/items/:itemId/received-quantity",
  validate(packageItemParamsSchema, "params"),
  validate(updateReceivedQuantitySchema),
  receivingController.updateReceivedQuantity,
);

receivingRoutes.post(
  "/:id/confirm-received",
  validate(idParamSchema, "params"),
  validate(confirmReceivedSchema),
  receivingController.confirmReceived,
);

