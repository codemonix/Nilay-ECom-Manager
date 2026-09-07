import { Router } from "express";
import * as caseController from "../controllers/caseController";
import { validate } from "../middleware/validate";
import { upload } from "../middleware/upload";
import { idParamSchema } from "../validators/commonValidators";
import {
  addNoteSchema,
  assignCaseSchema,
  changeContactPointSchema,
  changePrioritySchema,
  changeStatusSchema,
  createCaseSchema,
  linkItemSchema,
  linkOrderSchema,
  listCasesQuerySchema,
  tagActionSchema,
} from "../validators/caseValidators";

export const caseRoutes = Router();

caseRoutes.get("/", validate(listCasesQuerySchema, "query"), caseController.listCases);
caseRoutes.post("/", validate(createCaseSchema), caseController.createCase);

caseRoutes.get("/:id", validate(idParamSchema, "params"), caseController.getCase);

caseRoutes.get("/:id/events", validate(idParamSchema, "params"), caseController.getTimeline);
caseRoutes.post(
  "/:id/events",
  validate(idParamSchema, "params"),
  validate(addNoteSchema),
  caseController.addNoteEvent,
);

caseRoutes.post(
  "/:id/status",
  validate(idParamSchema, "params"),
  validate(changeStatusSchema),
  caseController.changeStatus,
);

caseRoutes.post(
  "/:id/priority",
  validate(idParamSchema, "params"),
  validate(changePrioritySchema),
  caseController.changePriority,
);

caseRoutes.post(
  "/:id/contact-point",
  validate(idParamSchema, "params"),
  validate(changeContactPointSchema),
  caseController.changeContactPoint,
);

caseRoutes.post(
  "/:id/assign",
  validate(idParamSchema, "params"),
  validate(assignCaseSchema),
  caseController.assignCase,
);

caseRoutes.post(
  "/:id/notes",
  validate(idParamSchema, "params"),
  validate(addNoteSchema),
  caseController.addNoteEvent,
);

caseRoutes.post(
  "/:id/orders",
  validate(idParamSchema, "params"),
  validate(linkOrderSchema),
  caseController.linkOrder,
);

caseRoutes.post(
  "/:id/items",
  validate(idParamSchema, "params"),
  validate(linkItemSchema),
  caseController.linkItem,
);

caseRoutes.post(
  "/:id/tags",
  validate(idParamSchema, "params"),
  validate(tagActionSchema),
  caseController.addTag,
);
caseRoutes.delete(
  "/:id/tags",
  validate(idParamSchema, "params"),
  validate(tagActionSchema),
  caseController.removeTag,
);

caseRoutes.get("/:id/attachments", validate(idParamSchema, "params"), caseController.listAttachments);
caseRoutes.post(
  "/:id/attachments",
  validate(idParamSchema, "params"),
  upload.single("file"),
  caseController.uploadAttachment,
);
