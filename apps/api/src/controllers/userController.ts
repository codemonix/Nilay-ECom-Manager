import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { serializeUser } from "../utils/serializers";
import * as userService from "../services/userService";
import type { CreateUserInput, UpdateUserInput, ResetPasswordInput } from "../validators/userValidators";

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.listStaff();
  return sendSuccess(res, users.map(serializeUser));
});

export const listAllUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.listAllUsers();
  return sendSuccess(res, users.map(serializeUser));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateUserInput;
  const user = await userService.createUser(input);
  return sendCreated(res, serializeUser(user));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateUserInput;
  const user = await userService.updateUser(req.params.id as string, input);
  return sendSuccess(res, serializeUser(user));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = req.body as ResetPasswordInput;
  await userService.resetPassword(req.params.id as string, newPassword);
  return sendSuccess(res, { reset: true });
});
