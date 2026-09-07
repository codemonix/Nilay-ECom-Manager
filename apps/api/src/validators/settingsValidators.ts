import { z } from "zod";
import { DATA_SOURCE_VALUES, SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";

export const updateDataSourceSchema = z.object({
  dataSource: z.enum(DATA_SOURCE_VALUES as [string, ...string[]]),
});
export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;

export const updateSystemLogLevelSchema = z.object({
  systemLogLevel: z.enum(SYSTEM_LOG_LEVEL_VALUES as [string, ...string[]]),
});
export type UpdateSystemLogLevelInput = z.infer<typeof updateSystemLogLevelSchema>;
