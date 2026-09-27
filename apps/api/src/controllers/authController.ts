import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { serializeUser } from "../utils/serializers";
import * as authService from "../services/authService";
import { userRepository } from "../repositories/userRepository";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../utils/refreshCookie";
import type { LoginInput, ChangePasswordInput, UpdateQuickAccessMenuInput } from "../validators/authValidators";

function clientInfo(req: Request): authService.ClientInfo {
  return { userAgent: req.header("user-agent") ?? null, ip: req.ip ?? null };
}

function sendSession(res: Response, session: authService.IssuedSession) {
  if (session.refreshToken && session.refreshTokenExpiresAt) {
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
  }
  return sendSuccess(res, { token: session.accessToken, user: serializeUser(session.user) });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const session = await authService.login(email, password, clientInfo(req));
  return sendSession(res, session);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  try {
    const session = await authService.refresh(readRefreshCookie(req), clientInfo(req));
    return sendSession(res, session);
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  return sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.findById(req.currentUser!.id);
  if (!user) throw ApiError.notFound("User not found");
  return sendSuccess(res, serializeUser(user));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  await authService.changeOwnPassword(req.currentUser!.id, currentPassword, newPassword, readRefreshCookie(req));
  return sendSuccess(res, { changed: true });
});

export const updateQuickAccessMenu = asyncHandler(async (req: Request, res: Response) => {
  const { quickAccessMenu } = req.body as UpdateQuickAccessMenuInput;
  const user = await authService.updateOwnQuickAccessMenu(req.currentUser!.id, quickAccessMenu);
  return sendSuccess(res, serializeUser(user));
});
