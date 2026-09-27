import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is
 * stored -- the raw value lives solely in the client's httpOnly cookie.
 * Tokens are single-use: each /auth/refresh revokes the presented token
 * (revokedAt + replacedAt) and issues a new one, so reuse of an already
 * rotated token signals theft and revokes all of that user's sessions (see
 * services/authService.ts#refresh). The TTL index lets MongoDB drop rows
 * once they have expired.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    /** Set when revoked by rotation (not by logout/reuse) -- enables the concurrent-refresh grace window. */
    replacedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDocument = HydratedDocument<InferSchemaType<typeof refreshTokenSchema>>;
export const RefreshTokenModel = model("RefreshToken", refreshTokenSchema);
