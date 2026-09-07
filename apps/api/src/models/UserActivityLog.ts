import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * One authenticated HTTP request, recorded by middleware/activityLogger.ts
 * -- the "all users activity" log independent of ShopfaTransactionLog and
 * SystemLog. userId/userName/userRole are snapshotted at request time (not
 * populated from User) so a log entry still reads correctly after the user
 * is later renamed, reassigned a role, or deleted.
 */
const userActivityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userActivityLogSchema.index({ createdAt: -1 });
userActivityLogSchema.index({ userId: 1, createdAt: -1 });

export type UserActivityLogSchemaType = InferSchemaType<typeof userActivityLogSchema>;
export type UserActivityLogDocument = HydratedDocument<UserActivityLogSchemaType>;
export const UserActivityLogModel = model("UserActivityLog", userActivityLogSchema);
