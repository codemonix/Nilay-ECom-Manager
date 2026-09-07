import type { DataSource, SystemLogLevel } from "@complaint-system/shared";
import { SettingsModel, type SettingsDocument } from "../models/Settings";

const SETTINGS_ID = "app";

export interface ImportSummaryData {
  fileName: string;
  importedAt: Date;
  importedBy: string | null;
  rowsProcessed: number;
  rowsSkipped: number;
  ordersImported: number;
  itemsImported: number;
}

export const settingsRepository = {
  async getOrCreate(): Promise<SettingsDocument> {
    const existing = await SettingsModel.findById(SETTINGS_ID).populate("lastImport.importedBy", "name");
    if (existing) return existing;
    return SettingsModel.create({ _id: SETTINGS_ID });
  },

  async setDataSource(dataSource: DataSource): Promise<SettingsDocument> {
    const doc = await this.getOrCreate();
    doc.dataSource = dataSource;
    await doc.save();
    return doc;
  },

  async setSystemLogLevel(systemLogLevel: SystemLogLevel): Promise<SettingsDocument> {
    const doc = await this.getOrCreate();
    doc.systemLogLevel = systemLogLevel;
    await doc.save();
    return doc;
  },

  async recordImport(summary: ImportSummaryData): Promise<SettingsDocument> {
    const doc = await this.getOrCreate();
    doc.lastImport = summary as SettingsDocument["lastImport"];
    await doc.save();
    await doc.populate("lastImport.importedBy", "name");
    return doc;
  },
};
