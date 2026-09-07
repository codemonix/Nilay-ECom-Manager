import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";

/**
 * Persisted mirror of winston's console output, written by
 * config/mongoLogTransport.ts -- one of the app's three independent log
 * streams (see also UserActivityLog and ShopfaTransactionLog). Only entries
 * at or above the current Settings.systemLogLevel are ever created, since
 * winston filters by `logger.level` before invoking any transport.
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

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ level: 1, createdAt: -1 });

export type SystemLogSchemaType = InferSchemaType<typeof systemLogSchema>;
export type SystemLogDocument = HydratedDocument<SystemLogSchemaType>;
export const SystemLogModel = model("SystemLog", systemLogSchema);
