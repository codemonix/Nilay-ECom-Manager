import { z } from "zod";
import { SOLD_QUANTITY_RANGE_DAYS_VALUES } from "@complaint-system/shared";

export const searchDevToolsItemsQuerySchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters to search"),
});
export type SearchDevToolsItemsQuery = z.infer<typeof searchDevToolsItemsQuerySchema>;

export const getSoldQuantityParamsSchema = z.object({
  productCode: z.string().trim().min(1, "Product code is required"),
});
export type GetSoldQuantityParams = z.infer<typeof getSoldQuantityParamsSchema>;

export const getSoldQuantityQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((value): value is (typeof SOLD_QUANTITY_RANGE_DAYS_VALUES)[number] =>
      (SOLD_QUANTITY_RANGE_DAYS_VALUES as readonly number[]).includes(value),
    {
      message: `days must be one of: ${SOLD_QUANTITY_RANGE_DAYS_VALUES.join(", ")}`,
    }),
});
export type GetSoldQuantityQuery = z.infer<typeof getSoldQuantityQuerySchema>;

export const titleAsteriskParamsSchema = z.object({
  productCode: z.string().trim().min(1, "Product code is required"),
});
export type TitleAsteriskParams = z.infer<typeof titleAsteriskParamsSchema>;

export const orderAdminNoteParamsSchema = z.object({
  orderNumber: z.string().trim().min(1, "Order number is required"),
});
export type OrderAdminNoteParams = z.infer<typeof orderAdminNoteParamsSchema>;

export const updateOrderAdminNoteBodySchema = z.object({
  note: z.string().max(2000, "Note is too long"),
});
export type UpdateOrderAdminNoteBody = z.infer<typeof updateOrderAdminNoteBodySchema>;
