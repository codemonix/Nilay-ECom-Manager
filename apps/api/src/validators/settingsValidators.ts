import { z } from "zod";
import { DATA_SOURCE_VALUES, SESSION_TTL_LIMITS, SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";

export const updateDataSourceSchema = z.object({
  dataSource: z.enum(DATA_SOURCE_VALUES as [string, ...string[]]),
});
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;

export const updateSystemLogLevelSchema = z.object({
  systemLogLevel: z.enum(SYSTEM_LOG_LEVEL_VALUES as [string, ...string[]]),
});
export type UpdateSystemLogLevelInput = z.infer<typeof updateSystemLogLevelSchema>;

const { accessTokenTtlMinutes, refreshTokenTtlDays } = SESSION_TTL_LIMITS;

export const updateSessionSettingsSchema = z.object({
  accessTokenTtlMinutes: z.number().int().min(accessTokenTtlMinutes.min).max(accessTokenTtlMinutes.max),
  refreshTokenTtlDays: z.number().int().min(refreshTokenTtlDays.min).max(refreshTokenTtlDays.max),
});
export type UpdateSessionSettingsInput = z.infer<typeof updateSessionSettingsSchema>;
