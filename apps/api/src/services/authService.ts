import { hasAdministrationAccess, hasMenuAccess, hasReportsMenuAccess, MenuKey } from "@complaint-system/shared";
import { userRepository } from "../repositories/userRepository";
import { ApiError } from "../utils/ApiError";
import { comparePassword, hashPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import type { UserDocument } from "../models/User";

export async function login(email: string, password: string): Promise<{ token: string; user: UserDocument }> {
  const user = await userRepository.findByEmailWithPassword(email);
  if (!user || !user.active) throw ApiError.unauthorized("Invalid email or password");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const token = signAccessToken({ sub: String(user._id), role: user.role });
  return { token, user };
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw ApiError.notFound("User not found");

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}

export async function updateOwnQuickAccessMenu(userId: string, quickAccessMenu: MenuKey[]): Promise<UserDocument> {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const hasUnauthorizedKey = quickAccessMenu.some((key) => {
    if (key === MenuKey.ADMINISTRATION) return !hasAdministrationAccess(user);
    if (key === MenuKey.REPORTING) return !hasReportsMenuAccess(user);
    return !hasMenuAccess(user, key);
  });
  if (hasUnauthorizedKey) throw ApiError.badRequest("Cannot pin a page you don't have access to");

  user.quickAccessMenu = quickAccessMenu;
  await user.save();
  return user;
}
