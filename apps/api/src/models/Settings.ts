import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { DATA_SOURCE_VALUES, DataSource, SYSTEM_LOG_LEVEL_VALUES, SystemLogLevel } from "@complaint-system/shared";

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
 * internal system log level (see SystemLogLevel / config/logger.ts). See
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
  },
  { timestamps: true },
);

export type SettingsSchemaType = InferSchemaType<typeof settingsSchema>;
export type SettingsDocument = HydratedDocument<SettingsSchemaType>;
export const SettingsModel = model("Settings", settingsSchema);
