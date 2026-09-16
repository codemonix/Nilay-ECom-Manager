import { z } from "zod";
import {
  DEFAULT_SHORTAGE_REPORT_RANGE_DAYS,
  DEFAULT_SHORTAGE_REPORT_STATUS_CODES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  SHORTAGE_REPORT_RANGE_DAYS_VALUES,
} from "@complaint-system/shared";

const VALID_STATUS_CODES = new Set(SHOPFA_ORDER_STATUS_OPTIONS.map((option) => option.code));

/** `statusCodes` arrives as a comma-separated list of Shopfa status codes (e.g. "8,9"), defaulting to DEFAULT_SHORTAGE_REPORT_STATUS_CODES when omitted. */
export const shortageReportQuerySchema = z.object({
  statusCodes: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((code) => Number(code.trim()))
            .filter((code) => !Number.isNaN(code))
        : DEFAULT_SHORTAGE_REPORT_STATUS_CODES,
    )
    .refine((codes) => codes.length > 0, "At least one status must be selected")
    .refine(
      (codes) => codes.every((code) => VALID_STATUS_CODES.has(code)),
      `statusCodes must only contain known status codes: ${Array.from(VALID_STATUS_CODES).join(", ")}`,
    ),
  days: z.coerce
    .number()
    .optional()
    .default(DEFAULT_SHORTAGE_REPORT_RANGE_DAYS)
    .refine((value): value is (typeof SHORTAGE_REPORT_RANGE_DAYS_VALUES)[number] =>
      (SHORTAGE_REPORT_RANGE_DAYS_VALUES as readonly number[]).includes(value),
    {
      message: `days must be one of: ${SHORTAGE_REPORT_RANGE_DAYS_VALUES.join(", ")}`,
    }),
});
export type ShortageReportQuery = z.infer<typeof shortageReportQuerySchema>;
