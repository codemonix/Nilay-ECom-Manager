import { z } from "zod";
import { MenuKey, StaffRole } from "@complaint-system/shared";

const permissionsSchema = z.array(z.nativeEnum(MenuKey));

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(StaffRole),
  permissions: permissionsSchema.optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.nativeEnum(StaffRole).optional(),
  active: z.boolean().optional(),
  permissions: permissionsSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
