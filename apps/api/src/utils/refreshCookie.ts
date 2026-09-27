import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";

export const REFRESH_COOKIE_NAME = "refresh_token";

/**
 * httpOnly so page scripts (and any XSS) can't read it; SameSite=Strict so
 * cross-site requests never carry it; scoped to /api/auth so it is only
 * sent to login/refresh/logout/change-password, not every API call. The web
 * app and API are same-site in both dev (localhost ports) and production
 * (same origin), which Strict requires.
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}

/** Minimal Cookie header parse for the one cookie we set (avoids pulling in cookie-parser). */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== REFRESH_COOKIE_NAME) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
