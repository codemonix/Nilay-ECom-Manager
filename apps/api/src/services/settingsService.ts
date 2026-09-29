import {
  DataSource,
  type SystemLogLevel,
  type AppSettingsDTO,
  type AppConfigDTO,
  type ShopfaConnectionTestResultDTO,
  type LogSizesDTO,
  type SessionSettingsInputDTO,
  type UploadSettingsInputDTO,
} from "@complaint-system/shared";
import { env } from "../config/env";
import { settingsRepository } from "../repositories/settingsRepository";
import type { SettingsDocument } from "../models/Settings";
import { ApiError } from "../utils/ApiError";
import { testShopfaConnection as pingShopfa } from "../integrations/shopfa/shopfaConnectionTest";
import { applyLogLevel } from "../config/logger";
import { userActivityLogRepository } from "../repositories/userActivityLogRepository";
import { shopfaTransactionLogRepository } from "../repositories/shopfaTransactionLogRepository";

/** After `.populate("lastImport.importedBy", "name")`, importedBy is either null or a populated User doc. */
type PopulatedImportedBy = { _id: unknown; name?: string } | null;

function serialize(doc: SettingsDocument): AppSettingsDTO {
  const lastImport = doc.lastImport;
  const importedBy = lastImport?.importedBy as unknown as PopulatedImportedBy;
  return {
    dataSource: doc.dataSource as DataSource,
    shopfaApiConfigured: Boolean(env.SHOPFA_API_BASE_URL && env.SHOPFA_API_TOKEN),
    lastImport: lastImport
      ? {
          fileName: lastImport.fileName,
          importedAt: lastImport.importedAt.toISOString(),
          importedBy: importedBy ? String(importedBy._id) : null,
          importedByName: importedBy?.name ?? null,
          rowsProcessed: lastImport.rowsProcessed,
          rowsSkipped: lastImport.rowsSkipped,
          ordersImported: lastImport.ordersImported,
          itemsImported: lastImport.itemsImported,
        }
      : null,
    systemLogLevel: doc.systemLogLevel as SystemLogLevel,
    accessTokenTtlMinutes: doc.accessTokenTtlMinutes,
    refreshTokenTtlDays: doc.refreshTokenTtlDays,
    maxImageUploadSizeMB: doc.maxImageUploadSizeMB,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getSettings(): Promise<AppSettingsDTO> {
  const doc = await settingsRepository.getOrCreate();
  return serialize(doc);
}

/** System-wide config readable by every authenticated user -- see AppConfigDTO. */
export async function getAppConfig(): Promise<AppConfigDTO> {
  const { dataSource, shopfaApiConfigured, maxImageUploadSizeMB } = await getSettings();
  return { dataSource, shopfaApiConfigured, maxImageUploadSizeMB };
}

export async function setDataSource(dataSource: DataSource): Promise<AppSettingsDTO> {
  if (dataSource === DataSource.LIVE_API && !(env.SHOPFA_API_BASE_URL && env.SHOPFA_API_TOKEN)) {
    throw ApiError.badRequest(
      "Cannot enable the live Shopfa API connection: SHOPFA_API_BASE_URL / SHOPFA_API_TOKEN are not configured on the server.",
    );
  }
  const doc = await settingsRepository.setDataSource(dataSource);
  return serialize(doc);
}

export async function testShopfaConnection(): Promise<ShopfaConnectionTestResultDTO> {
  return pingShopfa();
}

/** Persists the new level and applies it to the running logger immediately -- see config/logger.ts#applyLogLevel. */
export async function setSystemLogLevel(systemLogLevel: SystemLogLevel): Promise<AppSettingsDTO> {
  const doc = await settingsRepository.setSystemLogLevel(systemLogLevel);
  applyLogLevel(systemLogLevel);
  return serialize(doc);
}

/**
 * Applies to tokens issued from now on (next login/refresh); already-issued
 * access tokens keep their original expiry, which is short by design.
 */
export async function setSessionTtls(input: SessionSettingsInputDTO): Promise<AppSettingsDTO> {
  const accessTtlMs = input.accessTokenTtlMinutes * 60_000;
  const refreshTtlMs = input.refreshTokenTtlDays * 86_400_000;
  if (refreshTtlMs <= accessTtlMs) {
    throw ApiError.badRequest("The refresh token lifetime must be longer than the access token lifetime");
  }
  const doc = await settingsRepository.setSessionTtls(input.accessTokenTtlMinutes, input.refreshTokenTtlDays);
  return serialize(doc);
}

/** Lifetimes used by authService when issuing tokens. */
export async function getSessionTtls(): Promise<{ accessTokenTtlSeconds: number; refreshTokenTtlMs: number }> {
  const doc = await settingsRepository.getOrCreate();
  return {
    accessTokenTtlSeconds: doc.accessTokenTtlMinutes * 60,
    refreshTokenTtlMs: doc.refreshTokenTtlDays * 86_400_000,
  };
}

export async function setMaxImageUploadSize(input: UploadSettingsInputDTO): Promise<AppSettingsDTO> {
  const doc = await settingsRepository.setMaxImageUploadSize(input.maxImageUploadSizeMB);
  return serialize(doc);
}

/** The per-image cap in bytes, enforced by middleware/upload.ts#enforceImageSizeLimit. */
export async function getMaxImageUploadBytes(): Promise<number> {
  const doc = await settingsRepository.getOrCreate();
  return Math.round(doc.maxImageUploadSizeMB * 1024 * 1024);
}

/**
 * Sizes of UserActivityLog and ShopfaTransactionLog -- unlike SystemLog
 * (capped at 60 days / 50 MB, see jobs/systemLogRetentionJob.ts), these two
 * streams have no rotation yet, so the Settings page surfaces their current
 * size for the admin to keep an eye on.
 */
export async function getLogSizes(): Promise<LogSizesDTO> {
  const [userActivity, shopfaTransactions] = await Promise.all([
    userActivityLogRepository.getStats(),
    shopfaTransactionLogRepository.getStats(),
  ]);
  return { userActivity, shopfaTransactions };
}
