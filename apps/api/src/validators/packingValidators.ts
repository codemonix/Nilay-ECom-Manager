import { z } from "zod";
import { DEFAULT_PACKING_RANGE_DAYS, PACKING_RANGE_DAYS_VALUES } from "@complaint-system/shared";

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().min(1),
});
export type OrderNumberParam = z.infer<typeof orderNumberParamSchema>;

export const listPackingQuerySchema = z.object({
  days: z.coerce
    .number()
    .optional()
    .default(DEFAULT_PACKING_RANGE_DAYS)
    .refine((value): value is (typeof PACKING_RANGE_DAYS_VALUES)[number] =>
      (PACKING_RANGE_DAYS_VALUES as readonly number[]).includes(value),
    {
      message: `days must be one of: ${PACKING_RANGE_DAYS_VALUES.join(", ")}`,
    }),
});
export type ListPackingQuery = z.infer<typeof listPackingQuerySchema>;
