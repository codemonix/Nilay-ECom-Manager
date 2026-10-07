import { z } from "zod";
import { CASE_CATEGORY_VALUES } from "@complaint-system/shared";

export const createOrderCaseSchema = z.object({
  category: z.enum(CASE_CATEGORY_VALUES as [string, ...string[]]),
  subject: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional(),
  productCodes: z.array(z.string().min(1)).optional(),
});
export type CreateOrderCaseInput = z.infer<typeof createOrderCaseSchema>;
