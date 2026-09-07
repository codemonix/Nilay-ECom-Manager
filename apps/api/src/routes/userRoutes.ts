import { Router } from "express";
import { MenuKey, StaffRole } from "@complaint-system/shared";
import * as userController from "../controllers/userController";
import { validate } from "../middleware/validate";
import { requirePermission, requireRole } from "../middleware/authenticate";
import { idParamSchema } from "../validators/commonValidators";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "../validators/userValidators";

export const userRoutes = Router();

// Any authenticated user can see the active staff list (used e.g. to assign
// a case), independent of who has the "users" management menu permission.
userRoutes.get("/", userController.listUsers);
userRoutes.get("/all", requirePermission(MenuKey.USERS), userController.listAllUsers);
userRoutes.post("/", requireRole(StaffRole.ADMIN), validate(createUserSchema), userController.createUser);
userRoutes.patch(
  "/:id",
  requireRole(StaffRole.ADMIN),
  validate(idParamSchema, "params"),
  validate(updateUserSchema),
  userController.updateUser,
);
userRoutes.post(
  "/:id/reset-password",
  requireRole(StaffRole.ADMIN),
  validate(idParamSchema, "params"),
  validate(resetPasswordSchema),
  userController.resetPassword,
);
