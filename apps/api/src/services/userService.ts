import { DEFAULT_PERMISSIONS_BY_ROLE } from "@complaint-system/shared";
import { userRepository } from "../repositories/userRepository";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import type { CreateUserInput, UpdateUserInput } from "../validators/userValidators";

export async function listStaff() {
  return userRepository.listActive();
}

export async function listAllUsers() {
  return userRepository.listAll();
}

export async function createUser(input: CreateUserInput) {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const permissions = input.permissions ?? DEFAULT_PERMISSIONS_BY_ROLE[input.role];
  return userRepository.create({ name: input.name, email: input.email, passwordHash, role: input.role, permissions });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  if (input.name !== undefined) user.name = input.name;
  if (input.role !== undefined) user.role = input.role;
  if (input.active !== undefined) user.active = input.active;
  if (input.permissions !== undefined) user.permissions = input.permissions;

  await user.save();
  return user;
}

export async function resetPassword(id: string, newPassword: string) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}
