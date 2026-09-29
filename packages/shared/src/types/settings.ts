import type { DataSource } from "../constants/settingsEnums";
import type { SystemLogLevel } from "../constants/logEnums";

export interface LastImportSummaryDTO {
  fileName: string;
  importedAt: string;
  importedBy: string | null;
  importedByName: string | null;
  rowsProcessed: number;
  rowsSkipped: number;
  ordersImported: number;
  itemsImported: number;
}

export interface AppSettingsDTO {
  dataSource: DataSource;
  /** Whether SHOPFA_API_BASE_URL/SHOPFA_API_TOKEN are configured on the server -- "live_api" can't be enabled without this. */
  shopfaApiConfigured: boolean;
  lastImport: LastImportSummaryDTO | null;
  /** Minimum severity written to the console and the SystemLog collection; see SystemLogLevel. */
  systemLogLevel: SystemLogLevel;
  /** Lifetime of each access token (JWT); see SESSION_TTL_LIMITS. */
  accessTokenTtlMinutes: number;
  /** Lifetime of each refresh token, restarted on every refresh; see SESSION_TTL_LIMITS. */
  refreshTokenTtlDays: number;
  /** Largest image accepted per upload, in MB; see IMAGE_UPLOAD_LIMITS. */
  maxImageUploadSizeMB: number;
  updatedAt: string;
}

/** Body of PATCH /api/settings/session (admin only). */
export interface SessionSettingsInputDTO {
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
}

/** Body of PATCH /api/settings/uploads. */
export interface UploadSettingsInputDTO {
  maxImageUploadSizeMB: number;
}

/**
 * The system-wide slice of AppSettingsDTO that every authenticated user may
 * read (GET /api/app-config). Pages outside Settings need the data-source
 * toggle to decide whether live-API features are available, but most users
 * lack the Settings permission that guards the full AppSettingsDTO.
 */
export interface AppConfigDTO {
  dataSource: DataSource;
  shopfaApiConfigured: boolean;
  /** Every page that uploads images compresses them to fit under this. */
  maxImageUploadSizeMB: number;
}

/** Result of a live, read-only ping to Shopfa's /api/system/info -- lets the Settings page show whether the app can actually reach the shop, independent of the data-source toggle. */
export interface ShopfaConnectionTestResultDTO {
  ok: boolean;
  httpStatus?: number;
  message: string;
  shop?: {
    title?: string;
    domain?: string;
    url?: string;
  };
  /** Raw /api/system/info response body, for troubleshooting. */
  raw?: unknown;
}

export interface ImportOrdersResultDTO {
  rowsProcessed: number;
  rowsSkipped: number;
  ordersImported: number;
  itemsImported: number;
  skippedSamples: Array<{ row: number; reason: string }>;
  settings: AppSettingsDTO;
}
