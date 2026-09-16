import { z } from "zod";
import { PACKAGE_STATUS_VALUES } from "@complaint-system/shared";
import { paginationQuerySchema } from "./commonValidators";

export const listReceivingPackagesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PACKAGE_STATUS_VALUES as [string, ...string[]]).optional(),
});
export type ListReceivingPackagesQuery = z.infer<typeof listReceivingPackagesQuerySchema>;

export const updateReceivedQuantitySchema = z.object({
  receivedQuantity: z.coerce.number().int().min(0),
});
export type UpdateReceivedQuantityInput = z.infer<typeof updateReceivedQuantitySchema>;

export const confirmReceivedSchema = z.object({
  markAllComplete: z.boolean().optional(),
});
export type ConfirmReceivedInput = z.infer<typeof confirmReceivedSchema>;
