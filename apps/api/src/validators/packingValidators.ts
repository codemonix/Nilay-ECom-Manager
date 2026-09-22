import { z } from "zod";
import { DEFAULT_PACKING_RANGE_DAYS, PACKING_RANGE_DAYS_VALUES } from "@complaint-system/shared";
import { paginationQuerySchema } from "./commonValidators";

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

const packingItemSnapshotSchema = z.object({
  productCode: z.string().min(1),
  title: z.string().min(1),
  quantity: z.number().int().min(1),
});

const packedOrderSnapshotSchema = z.object({
  orderNumber: z.string().min(1),
  externalOrderId: z.string().min(1),
  buyerName: z.string().nullable(),
  items: z.array(packingItemSnapshotSchema).min(1),
});

/**
 * Multipart form for Packing's "send" action, which sends a whole customer
 * group at once: `photos` (zero or more files, handled by multer before this
 * runs) alongside a JSON-encoded snapshot of every order in the group as the
 * Packing page already has them loaded -- see markOrderPacked's doc for why
 * the server trusts this snapshot instead of re-fetching from Shopfa.
 * `orders` arrives as a JSON string because multipart/form-data fields are
 * all plain strings.
 */
export const sendPackedOrdersSchema = z.object({
  orders: z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "orders must be valid JSON" });
        return z.NEVER;
      }
    })
    .pipe(z.array(packedOrderSnapshotSchema).min(1)),
});
export type SendPackedOrdersInput = z.infer<typeof sendPackedOrdersSchema>;

export const listPackingHistoryQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});
export type ListPackingHistoryQuery = z.infer<typeof listPackingHistoryQuerySchema>;
