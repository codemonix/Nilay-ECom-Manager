import { Types } from "mongoose";
import { RefreshTokenModel, type RefreshTokenDocument } from "../models/RefreshToken";

export const refreshTokenRepository = {
  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ip: string | null;
  }): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create({
      user: new Types.ObjectId(data.userId),
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ip: data.ip,
    });
  },

  async findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash });
  },

  /**
   * Atomically marks an active token as rotated. Returns null if another
   * request already revoked it -- i.e. the loser of a concurrent refresh.
   */
  async markRotated(id: Types.ObjectId, now: Date): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOneAndUpdate(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: now, replacedAt: now } },
      { new: true },
    );
  },

  async revokeByHash(tokenHash: string): Promise<void> {
    await RefreshTokenModel.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  /** Revokes every active session of a user, optionally keeping one (the caller's own). */
  async revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<void> {
    const filter: Record<string, unknown> = { user: new Types.ObjectId(userId), revokedAt: null };
    if (exceptTokenHash) filter.tokenHash = { $ne: exceptTokenHash };
    await RefreshTokenModel.updateMany(filter, { $set: { revokedAt: new Date() } });
  },
};
