import { z } from "zod";
import { ORDER_PRECHECK_DEFAULT_STATUS_CODES, SHOPFA_ORDER_STATUS_OPTIONS } from "@complaint-system/shared";

const VALID_STATUS_CODES = new Set(SHOPFA_ORDER_STATUS_OPTIONS.map((option) => option.code));

/** `statusCodes` arrives as a comma-separated list of Shopfa status codes (e.g. "4,8"), defaulting to ORDER_PRECHECK_DEFAULT_STATUS_CODES when omitted. */
export const listOrderPrecheckQuerySchema = z.object({
  statusCodes: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((code) => Number(code.trim()))
            .filter((code) => !Number.isNaN(code))
        : ORDER_PRECHECK_DEFAULT_STATUS_CODES,
    )
    .refine((codes) => codes.length > 0, "At least one status must be selected")
    .refine(
      (codes) => codes.every((code) => VALID_STATUS_CODES.has(code)),
      `statusCodes must only contain known status codes: ${Array.from(VALID_STATUS_CODES).join(", ")}`,
    ),
});
export type ListOrderPrecheckQuery = z.infer<typeof listOrderPrecheckQuerySchema>;

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().min(1),
});
export type OrderNumberParam = z.infer<typeof orderNumberParamSchema>;

export const saveOrderPrecheckSchema = z.object({
  items: z
    .array(
      z.object({
        productCode: z.string().min(1),
        available: z.boolean(),
      }),
    )
    .min(1, "At least one item's availability must be provided"),
  confirmStatusChanges: z.boolean().optional(),
});
export type SaveOrderPrecheckInput = z.infer<typeof saveOrderPrecheckSchema>;
