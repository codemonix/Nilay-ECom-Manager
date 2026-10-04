import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  hasMenuAccess,
  hasReportAccess,
  hasReportsMenuAccess,
  SecurityEventType,
  type MenuKey,
  type ReportKey,
} from "@complaint-system/shared";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { UserModel } from "../models/User";
import { verifyAccessToken } from "../utils/jwt";
import * as securityEventService from "../services/securityEventService";

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
  } catch (err) {
    // Expiry is routine (the web app refreshes and retries); a bad
    // signature or malformed token means someone crafted or altered it.
    if (!(err instanceof jwt.TokenExpiredError)) {
      securityEventService.record(req, SecurityEventType.INVALID_ACCESS_TOKEN, {
        details: { reason: err instanceof Error ? err.message : "invalid" },
      });
    }
    throw ApiError.unauthorized("Invalid or expired session");
  }

  const user = await UserModel.findById(payload.sub).lean();
  if (!user || !user.active) {
    securityEventService.record(req, SecurityEventType.INVALID_ACCESS_TOKEN, {
      userId: user ? String(user._id) : null,
      userName: user?.name ?? null,
      details: { reason: user ? "user_deactivated" : "user_not_found" },
    });
    throw ApiError.unauthorized("Invalid or expired session");
  }

  req.currentUser = { id: String(user._id), name: user.name, role: user.role, permissions: user.permissions ?? [] };
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) {
    securityEventService.record(req, SecurityEventType.UNAUTHENTICATED_ACCESS);
    throw ApiError.unauthorized();
  }
  next();
}

/** Records the denial for the security log (see SecurityEventType.ACCESS_DENIED) and returns the 403 to throw. */
function denied(req: Request): ApiError {
  securityEventService.record(req, SecurityEventType.ACCESS_DENIED);
  return ApiError.forbidden();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) throw ApiError.unauthorized();
    if (!roles.includes(req.currentUser.role)) throw denied(req);
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
    if (!hasMenuAccess(req.currentUser, key)) throw denied(req);
    next();
  };
}

/** Like requirePermission, but passes when the user has any one of the given menu sections. */
export function requireAnyPermission(...keys: MenuKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) throw ApiError.unauthorized();
    if (!keys.some((key) => hasMenuAccess(req.currentUser!, key))) throw denied(req);
    next();
  };
}

/** Gates one specific report (see ReportKey) -- admins always pass, everyone else needs that exact report key (or the legacy all-reports grant, see hasReportAccess). */
export function requireReportAccess(key: ReportKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) throw ApiError.unauthorized();
    if (!hasReportAccess(req.currentUser, key)) throw denied(req);
    next();
  };
}

/** Passes for anyone who can open at least one report -- for endpoints shared across reports, such as the order details page linked from several of them. */
export function requireAnyReportAccess(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) throw ApiError.unauthorized();
  if (!hasReportsMenuAccess(req.currentUser)) throw denied(req);
  next();
}
