import { Router } from "express";
import * as devToolsController from "../controllers/devToolsController";
import { validate } from "../middleware/validate";
import {
  getSoldQuantityParamsSchema,
  getSoldQuantityQuerySchema,
  orderAdminNoteParamsSchema,
  searchDevToolsItemsQuerySchema,
  titleAsteriskParamsSchema,
  updateOrderAdminNoteBodySchema,
} from "../validators/devToolsValidators";

export const devToolsRoutes = Router();

devToolsRoutes.get(
  "/products/search",
  validate(searchDevToolsItemsQuerySchema, "query"),
  devToolsController.searchItems,
);

devToolsRoutes.get(
  "/products/:productCode/sold-quantity",
  validate(getSoldQuantityParamsSchema, "params"),
  validate(getSoldQuantityQuerySchema, "query"),
  devToolsController.getSoldQuantity,
);

devToolsRoutes.get(
  "/products/:productCode/title-asterisk",
  validate(titleAsteriskParamsSchema, "params"),
  devToolsController.checkTitleAsterisk,
);

devToolsRoutes.post(
  "/products/:productCode/title-asterisk/toggle",
  validate(titleAsteriskParamsSchema, "params"),
  devToolsController.toggleTitleAsterisk,
);

devToolsRoutes.get(
  "/orders/:orderNumber/admin-note",
  validate(orderAdminNoteParamsSchema, "params"),
  devToolsController.getOrderAdminNote,
);

devToolsRoutes.post(
  "/orders/:orderNumber/admin-note",
  validate(orderAdminNoteParamsSchema, "params"),
  validate(updateOrderAdminNoteBodySchema, "body"),
  devToolsController.updateOrderAdminNote,
);
