import { z } from "zod";

export const searchShopfaProductsQuerySchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters to search"),
});
export type SearchShopfaProductsQuery = z.infer<typeof searchShopfaProductsQuerySchema>;
