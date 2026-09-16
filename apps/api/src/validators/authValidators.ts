import { z } from "zod";
import { MenuKey } from "@complaint-system/shared";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateQuickAccessMenuSchema = z.object({
  quickAccessMenu: z.array(z.nativeEnum(MenuKey)).max(4, "You can pin up to 4 pages"),
});
export type UpdateQuickAccessMenuInput = z.infer<typeof updateQuickAccessMenuSchema>;
