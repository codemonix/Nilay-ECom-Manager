import { hasMenuEntryAccess, MenuKey } from "@complaint-system/shared";
import { userRepository } from "../repositories/userRepository";
import { refreshTokenRepository } from "../repositories/refreshTokenRepository";
import { ApiError } from "../utils/ApiError";
import { comparePassword, hashPassword } from "../utils/password";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../utils/jwt";
import { getSessionTtls } from "./settingsService";
import { logger } from "../config/logger";
import type { UserDocument } from "../models/User";

/**
 * A refresh token rotated less than this long ago is still accepted (for an
 * access token only, without issuing another refresh token). Two tabs that
 * refresh at the same moment both send the same cookie; the loser of that
 * race must not be mistaken for a stolen token.
 */
const ROTATION_GRACE_MS = 30_000;

export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedSession {
  accessToken: string;
  /** Null when the existing cookie should be left as is (grace-window refresh). */
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
  user: UserDocument;
}

async function issueSession(user: UserDocument, client: ClientInfo): Promise<IssuedSession> {
  const { accessTokenTtlSeconds, refreshTokenTtlMs } = await getSessionTtls();
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenTtlMs);
  await refreshTokenRepository.create({
    userId: String(user._id),
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
    userAgent: client.userAgent,
    ip: client.ip,
  });
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role }, accessTokenTtlSeconds);
  return { accessToken, refreshToken, refreshTokenExpiresAt, user };
}

async function issueAccessTokenOnly(user: UserDocument): Promise<IssuedSession> {
  const { accessTokenTtlSeconds } = await getSessionTtls();
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role }, accessTokenTtlSeconds);
  return { accessToken, refreshToken: null, refreshTokenExpiresAt: null, user };
}

export async function login(email: string, password: string, client: ClientInfo): Promise<IssuedSession> {
  const user = await userRepository.findByEmailWithPassword(email);
  if (!user || !user.active) throw ApiError.unauthorized("Invalid email or password");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  return issueSession(user, client);
}

/**
 * Exchanges a refresh token for a new access token and a new (rotated)
 * refresh token. Presenting a token that was already rotated outside the
 * grace window means it was copied -- every session of that user is
 * revoked, forcing a fresh login everywhere.
 */
export async function refresh(rawToken: string | undefined, client: ClientInfo): Promise<IssuedSession> {
  if (!rawToken) throw ApiError.unauthorized("Session expired");

  const stored = await refreshTokenRepository.findByHash(hashRefreshToken(rawToken));
  const now = new Date();
  if (!stored || stored.expiresAt <= now) throw ApiError.unauthorized("Session expired");

  const user = await userRepository.findById(String(stored.user));
  if (!user || !user.active) throw ApiError.unauthorized("Session expired");

  if (stored.revokedAt) {
    const withinGrace = stored.replacedAt && now.getTime() - stored.replacedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace) return issueAccessTokenOnly(user);
    if (stored.replacedAt) {
      logger.warn("Rotated refresh token reused; revoking all sessions for user", { userId: String(user._id) });
      await refreshTokenRepository.revokeAllForUser(String(user._id));
    }
    throw ApiError.unauthorized("Session expired");
  }

  const rotated = await refreshTokenRepository.markRotated(stored._id, now);
  // Lost a race with a concurrent refresh of the same token: the winner's
  // response already set the new cookie, so only hand back an access token.
  if (!rotated) return issueAccessTokenOnly(user);
  return issueSession(user, client);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await refreshTokenRepository.revokeByHash(hashRefreshToken(rawToken));
}

/** Signs the user out of every other device; the session that made the change stays signed in. */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken?: string,
): Promise<void> {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw ApiError.notFound("User not found");

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await refreshTokenRepository.revokeAllForUser(
    userId,
    currentRefreshToken ? hashRefreshToken(currentRefreshToken) : undefined,
  );
}

export async function updateOwnQuickAccessMenu(userId: string, quickAccessMenu: MenuKey[]): Promise<UserDocument> {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const hasUnauthorizedKey = quickAccessMenu.some((key) => !hasMenuEntryAccess(user, key));
  if (hasUnauthorizedKey) throw ApiError.badRequest("Cannot pin a page you don't have access to");

  user.quickAccessMenu = quickAccessMenu;
  await user.save();
  return user;
}
