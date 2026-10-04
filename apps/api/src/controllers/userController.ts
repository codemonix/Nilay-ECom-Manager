import type { Request, Response } from "express";
import { SecurityEventType } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { sendCreated, sendSuccess } from "../utils/apiResponse";
import { serializeUser } from "../utils/serializers";
import * as userService from "../services/userService";
import * as securityEventService from "../services/securityEventService";
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
  securityEventService.record(req, SecurityEventType.USER_CREATED, {
    targetEmail: user.email,
    details: { userId: String(user._id), role: user.role, permissions: user.permissions },
  });
  return sendCreated(res, serializeUser(user));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateUserInput;
  const user = await userService.updateUser(req.params.id as string, input);
  securityEventService.record(req, SecurityEventType.USER_UPDATED, {
    targetEmail: user.email,
    details: { userId: String(user._id), changes: input },
  });
  return sendSuccess(res, serializeUser(user));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = req.body as ResetPasswordInput;
  const user = await userService.resetPassword(req.params.id as string, newPassword);
  securityEventService.record(req, SecurityEventType.USER_PASSWORD_RESET, {
    targetEmail: user.email,
    details: { userId: String(user._id) },
  });
  return sendSuccess(res, { reset: true });
});
