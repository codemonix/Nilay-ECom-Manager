import { z } from "zod";
import { paginationQuerySchema } from "./commonValidators";

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
