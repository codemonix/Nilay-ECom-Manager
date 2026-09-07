import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { serializeUser } from "../utils/serializers";
import * as authService from "../services/authService";
import { userRepository } from "../repositories/userRepository";
import type { LoginInput, ChangePasswordInput } from "../validators/authValidators";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const { token, user } = await authService.login(email, password);
  return sendSuccess(res, { token, user: serializeUser(user) });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.findById(req.currentUser!.id);
  if (!user) throw ApiError.notFound("User not found");
  return sendSuccess(res, serializeUser(user));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  await authService.changeOwnPassword(req.currentUser!.id, currentPassword, newPassword);
  return sendSuccess(res, { changed: true });
});
