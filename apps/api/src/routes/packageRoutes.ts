import { Router } from "express";
import * as packageController from "../controllers/packageController";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import { idParamSchema } from "../validators/commonValidators";
import {
  changePackageStatusSchema,
  createDraftPackageSchema,
  listPackagesQuerySchema,
  matchItemSchema,
  packageItemParamsSchema,
  receiveItemSchema,
  updateItemSchema,
} from "../validators/packageValidators";

export const packageRoutes = Router();

packageRoutes.get("/", validate(listPackagesQuerySchema, "query"), packageController.listPackages);
packageRoutes.post("/", validate(createDraftPackageSchema), packageController.createDraftPackage);
packageRoutes.get("/open-draft", packageController.getOpenDraftPackage);

packageRoutes.get("/:id", validate(idParamSchema, "params"), packageController.getPackage);
packageRoutes.get("/:id/events", validate(idParamSchema, "params"), packageController.getEvents);

packageRoutes.post(
  "/:id/items",
  validate(idParamSchema, "params"),
  upload.single("photo"),
  validate(receiveItemSchema),
  packageController.receiveItem,
);
packageRoutes.patch(
  "/:id/items/:itemId",
  validate(packageItemParamsSchema, "params"),
  validate(updateItemSchema),
  packageController.updateItem,
);
packageRoutes.delete(
  "/:id/items/:itemId",
  validate(packageItemParamsSchema, "params"),
  packageController.removeItem,
);

packageRoutes.post(
  "/:id/items/:itemId/match/preview",
  validate(packageItemParamsSchema, "params"),
  validate(matchItemSchema),
  packageController.previewMatchItem,
);
packageRoutes.post(
  "/:id/items/:itemId/match",
  validate(packageItemParamsSchema, "params"),
  validate(matchItemSchema),
  packageController.matchItem,
);
packageRoutes.post(
  "/:id/items/:itemId/unmatch",
  validate(packageItemParamsSchema, "params"),
  packageController.unmatchItem,
);

packageRoutes.post(
  "/:id/status",
  validate(idParamSchema, "params"),
  validate(changePackageStatusSchema),
  packageController.changeStatus,
);

packageRoutes.get("/:id/attachments", validate(idParamSchema, "params"), packageController.listAttachments);
packageRoutes.post(
  "/:id/attachments",
  validate(idParamSchema, "params"),
  upload.single("file"),
  packageController.uploadAttachment,
);
