import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { serializeUser } from "../utils/serializers";
import * as userService from "../services/userService";

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.listStaff();
  return sendSuccess(res, users.map(serializeUser));
});
