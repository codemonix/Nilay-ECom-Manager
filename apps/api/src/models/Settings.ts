import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import {
  DATA_SOURCE_VALUES,
  DataSource,
  IMAGE_UPLOAD_LIMITS,
  SESSION_TTL_LIMITS,
  SYSTEM_LOG_LEVEL_VALUES,
  SystemLogLevel,
} from "@complaint-system/shared";

const lastImportSchema = new Schema(
  {
    fileName: { type: String, required: true },
    importedAt: { type: Date, required: true },
    importedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rowsProcessed: { type: Number, required: true },
    rowsSkipped: { type: Number, required: true },
    ordersImported: { type: Number, required: true },
    itemsImported: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Singleton document (fixed _id) holding app-wide settings -- the Shopfa
 * data-source toggle, last-import metadata, and the admin-configurable
 * internal system log level (see SystemLogLevel / config/logger.ts), and
 * the access/refresh token lifetimes (see SESSION_TTL_LIMITS), and the
 * per-image upload cap (see IMAGE_UPLOAD_LIMITS). See
 * repositories/settingsRepository.ts#getOrCreate for how the single
 * document is created/fetched.
 */
const settingsSchema = new Schema(
  {
    _id: { type: String, default: "app" },
    dataSource: {
      type: String,
      enum: DATA_SOURCE_VALUES,
      required: true,
      default: DataSource.IMPORTED_FILE,
    },
    lastImport: { type: lastImportSchema, default: null },
    systemLogLevel: {
      type: String,
      enum: SYSTEM_LOG_LEVEL_VALUES,
      required: true,
      default: SystemLogLevel.INFO,
    },
    accessTokenTtlMinutes: {
      type: Number,
      required: true,
      min: SESSION_TTL_LIMITS.accessTokenTtlMinutes.min,
      max: SESSION_TTL_LIMITS.accessTokenTtlMinutes.max,
      default: SESSION_TTL_LIMITS.accessTokenTtlMinutes.default,
    },
    refreshTokenTtlDays: {
      type: Number,
      required: true,
      min: SESSION_TTL_LIMITS.refreshTokenTtlDays.min,
      max: SESSION_TTL_LIMITS.refreshTokenTtlDays.max,
      default: SESSION_TTL_LIMITS.refreshTokenTtlDays.default,
    },
    maxImageUploadSizeMB: {
      type: Number,
      required: true,
      min: IMAGE_UPLOAD_LIMITS.maxImageUploadSizeMB.min,
      max: IMAGE_UPLOAD_LIMITS.maxImageUploadSizeMB.max,
      default: IMAGE_UPLOAD_LIMITS.maxImageUploadSizeMB.default,
    },
  },
  { timestamps: true },
);

export type SettingsSchemaType = InferSchemaType<typeof settingsSchema>;
export type SettingsDocument = HydratedDocument<SettingsSchemaType>;
export const SettingsModel = model("Settings", settingsSchema);
