import { z } from "zod";
import { SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";
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
