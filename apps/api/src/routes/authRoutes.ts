import { Router } from "express";
import * as authController from "../controllers/authController";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/authenticate";
import { changePasswordSchema, loginSchema, updateQuickAccessMenuSchema } from "../validators/authValidators";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), authController.login);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);
authRoutes.patch(
  "/me/quick-access-menu",
  requireAuth,
  validate(updateQuickAccessMenuSchema),
  authController.updateQuickAccessMenu,
);
