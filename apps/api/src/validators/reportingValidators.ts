import { z } from "zod";
import {
  CATEGORY_TREND_WINDOWS,
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

/** Shared by the customer and item-sales reports: an inclusive Gregorian date window, at most a year wide. */
const dateWindowShape = {
  from: isoDate,
  to: isoDate,
};

function refineDateWindow<T extends { from: string; to: string }>(value: T, ctx: z.RefinementCtx) {
  const from = Date.parse(value.from);
  const to = Date.parse(value.to);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
    return;
  }
  if (to < from) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "`to` must not be before `from`" });
  if (to - from > 366 * 24 * 60 * 60 * 1000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The period can be at most one year" });
  }
}

export const customerReportQuerySchema = z
  .object({ query: z.string().trim().min(3, "Enter at least 3 characters of a name or mobile number"), ...dateWindowShape })
  .superRefine(refineDateWindow);
export type CustomerReportQuery = z.infer<typeof customerReportQuerySchema>;

export const itemSalesQuerySchema = z
  .object({
    productId: z.string().trim().min(1).optional(),
    categoryId: z.string().trim().min(1).optional(),
    ...dateWindowShape,
  })
  .superRefine(refineDateWindow)
  .refine((value) => Boolean(value.productId) !== Boolean(value.categoryId), {
    message: "Provide exactly one of productId or categoryId",
  });
export type ItemSalesQuery = z.infer<typeof itemSalesQuerySchema>;

export const productSearchQuerySchema = z.object({ q: z.string().trim().min(2, "Enter at least 2 characters") });
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const categoryTrendsQuerySchema = z
  .object({
    months: z.coerce
      .number()
      .refine((value) => CATEGORY_TREND_WINDOWS.some((window) => window.months === value), {
        message: `months must be one of: ${CATEGORY_TREND_WINDOWS.map((window) => window.months).join(", ")}`,
      }),
    stepDays: z.coerce.number().optional(),
  })
  .superRefine((value, ctx) => {
    const window = CATEGORY_TREND_WINDOWS.find((w) => w.months === value.months);
    if (window && value.stepDays !== undefined && !(window.stepOptions as readonly number[]).includes(value.stepDays)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stepDays"],
        message: `stepDays must be one of: ${window.stepOptions.join(", ")} for a ${window.months}-month window`,
      });
    }
  });
export type CategoryTrendsQuery = z.infer<typeof categoryTrendsQuerySchema>;
