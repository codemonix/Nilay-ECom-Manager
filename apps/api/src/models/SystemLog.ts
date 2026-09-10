import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";

/** Entries older than this are dropped automatically by MongoDB's TTL monitor -- see the createdAt index below. */
export const SYSTEM_LOG_RETENTION_DAYS = 60;

/**
 * Persisted mirror of winston's console output, written by
 * config/mongoLogTransport.ts -- one of the app's three independent log
 * streams (see also UserActivityLog and ShopfaTransactionLog). Only entries
 * at or above the current Settings.systemLogLevel are ever created, since
 * winston filters by `logger.level` before invoking any transport.
 *
 * Two independent rotation limits keep this collection bounded: age (via
 * the TTL index below, enforced natively by MongoDB) and total size (via
 * jobs/systemLogRetentionJob.ts, which MongoDB has no built-in mechanism
 * for and so is enforced by a periodic sweep instead).
 */
const systemLogSchema = new Schema(
  {
    level: { type: String, enum: SYSTEM_LOG_LEVEL_VALUES, required: true },
    message: { type: String, required: true },
    context: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

systemLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: SYSTEM_LOG_RETENTION_DAYS * 24 * 60 * 60 });
systemLogSchema.index({ level: 1, createdAt: -1 });

export type SystemLogSchemaType = InferSchemaType<typeof systemLogSchema>;
export type SystemLogDocument = HydratedDocument<SystemLogSchemaType>;
export const SystemLogModel = model("SystemLog", systemLogSchema);
