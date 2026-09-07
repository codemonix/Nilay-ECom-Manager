import type { NextFunction, Request, Response } from "express";
import { hasMenuAccess, type MenuKey } from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { UserModel } from "../models/User";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Parses the Authorization: Bearer <jwt> header, if present, and resolves it
 * into req.currentUser. Does not itself reject unauthenticated requests --
 * routes that require a signed-in user use requireAuth (or requireRole)
 * after this, which lets public endpoints (login, health) share the same
 * global middleware stack.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice("Bearer ".length).trim();
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired session");
  }

  const user = await UserModel.findById(payload.sub).lean();
  if (!user || !user.active) throw ApiError.unauthorized("Invalid or expired session");

  req.currentUser = { id: String(user._id), name: user.name, role: user.role, permissions: user.permissions ?? [] };
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) throw ApiError.unauthorized();
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) throw ApiError.unauthorized();
    if (!roles.includes(req.currentUser.role)) throw ApiError.forbidden();
    next();
  };
}

/**
 * Gates a route behind a main-menu section (see MenuKey). Admins always
 * pass (hasMenuAccess bypasses the stored list for them); everyone else
 * needs the key in their own permissions array, set by an admin on the
 * Users page.
 */
export function requirePermission(key: MenuKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) throw ApiError.unauthorized();
    if (!hasMenuAccess(req.currentUser, key)) throw ApiError.forbidden();
    next();
  };
}
