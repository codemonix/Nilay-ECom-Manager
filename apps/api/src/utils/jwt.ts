import crypto from "crypto";
import jwt from "jsonwebtoken";
import { SESSION_TTL_LIMITS } from "@complaint-system/shared";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = SESSION_TTL_LIMITS.accessTokenTtlMinutes.default * 60;

/** The lifetime normally comes from Settings (see settingsService#getSessionTtls); the default is for callers like tests. */
export function signAccessToken(payload: AccessTokenPayload, ttlSeconds = DEFAULT_ACCESS_TOKEN_TTL_SECONDS): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ttlSeconds });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

/** Opaque random refresh token (not a JWT -- it is only ever looked up by hash, see models/RefreshToken.ts). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
