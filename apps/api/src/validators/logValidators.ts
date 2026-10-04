import { z } from "zod";
import { SECURITY_EVENT_TYPE_VALUES, SECURITY_SEVERITY_VALUES, SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";
import { paginationQuerySchema, objectIdSchema } from "./commonValidators";

export const listSystemLogsQuerySchema = paginationQuerySchema.extend({
  level: z.enum(SYSTEM_LOG_LEVEL_VALUES as [string, ...string[]]).optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListSystemLogsQuery = z.infer<typeof listSystemLogsQuerySchema>;

export const listUserActivityLogsQuerySchema = paginationQuerySchema.extend({
  userId: objectIdSchema.optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListUserActivityLogsQuery = z.infer<typeof listUserActivityLogsQuerySchema>;

export const listShopfaTransactionLogsQuerySchema = paginationQuerySchema.extend({
  // z.coerce.boolean() would treat the string "false" as truthy (Boolean("false") === true),
  // so the query param is constrained to the two literal strings and mapped explicitly instead.
  success: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListShopfaTransactionLogsQuery = z.infer<typeof listShopfaTransactionLogsQuerySchema>;

export const listSecurityEventsQuerySchema = paginationQuerySchema.extend({
  type: z.enum(SECURITY_EVENT_TYPE_VALUES as [string, ...string[]]).optional(),
  severity: z.enum(SECURITY_SEVERITY_VALUES as [string, ...string[]]).optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListSecurityEventsQuery = z.infer<typeof listSecurityEventsQuerySchema>;

export const securityReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type SecurityReportQuery = z.infer<typeof securityReportQuerySchema>;
