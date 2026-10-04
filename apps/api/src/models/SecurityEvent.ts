import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { SECURITY_EVENT_TYPE_VALUES, SECURITY_SEVERITY_VALUES } from "@complaint-system/shared";

/** Entries older than this are dropped automatically by MongoDB's TTL monitor -- see the createdAt index below. */
export const SECURITY_EVENT_RETENTION_DAYS = 180;

/**
 * One security-relevant event, recorded by services/securityEventService.ts
 * -- the fourth log stream beside SystemLog, UserActivityLog and
 * ShopfaTransactionLog. Unlike UserActivityLog it also covers anonymous
 * requests (failed logins, forged tokens), which are exactly the ones an
 * attacker makes. userName is snapshotted like UserActivityLog's so an entry
 * still reads correctly after the user is renamed or deleted.
 */
const securityEventSchema = new Schema(
  {
    type: { type: String, enum: SECURITY_EVENT_TYPE_VALUES, required: true },
    severity: { type: String, enum: SECURITY_SEVERITY_VALUES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: null },
    targetEmail: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

securityEventSchema.index({ createdAt: -1 }, { expireAfterSeconds: SECURITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 });
securityEventSchema.index({ type: 1, createdAt: -1 });
securityEventSchema.index({ ip: 1, createdAt: -1 });

export type SecurityEventSchemaType = InferSchemaType<typeof securityEventSchema>;
export type SecurityEventDocument = HydratedDocument<SecurityEventSchemaType>;
export const SecurityEventModel = model("SecurityEvent", securityEventSchema);
