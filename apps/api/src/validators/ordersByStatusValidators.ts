import { z } from "zod";
import {
  DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS,
  ORDERS_BY_STATUS_RANGE_DAYS_VALUES,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";

const VALID_STATUS_CODES = new Set(SHOPFA_ORDER_STATUS_OPTIONS.map((option) => option.code));

/** `statusCodes` is a comma-separated list of Shopfa status codes (e.g. "8,10"); at least one is required. */
export const ordersByStatusQuerySchema = z.object({
  statusCodes: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((code) => Number(code.trim()))
        .filter((code) => !Number.isNaN(code)),
    )
    .refine((codes) => codes.length > 0, "At least one status must be selected")
    .refine(
      (codes) => codes.every((code) => VALID_STATUS_CODES.has(code)),
      `statusCodes must only contain known status codes: ${Array.from(VALID_STATUS_CODES).join(", ")}`,
    ),
  days: z.coerce
    .number()
    .optional()
    .default(DEFAULT_ORDERS_BY_STATUS_RANGE_DAYS)
    .refine((value): value is (typeof ORDERS_BY_STATUS_RANGE_DAYS_VALUES)[number] =>
      (ORDERS_BY_STATUS_RANGE_DAYS_VALUES as readonly number[]).includes(value),
    {
      message: `days must be one of: ${ORDERS_BY_STATUS_RANGE_DAYS_VALUES.join(", ")}`,
    }),
});
export type OrdersByStatusQuery = z.infer<typeof ordersByStatusQuerySchema>;
