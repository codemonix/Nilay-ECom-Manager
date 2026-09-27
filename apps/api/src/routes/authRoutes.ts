import { Router } from "express";
import * as authController from "../controllers/authController";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/authenticate";
import { changePasswordSchema, loginSchema, updateQuickAccessMenuSchema } from "../validators/authValidators";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), authController.login);
// Both authenticate via the httpOnly refresh cookie, not the Bearer header,
// so they work after the access token has expired.
authRoutes.post("/refresh", authController.refresh);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);
authRoutes.patch(
  "/me/quick-access-menu",
  requireAuth,
  validate(updateQuickAccessMenuSchema),
  authController.updateQuickAccessMenu,
);
