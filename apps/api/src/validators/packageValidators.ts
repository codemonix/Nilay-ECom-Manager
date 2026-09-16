import { z } from "zod";
import { PACKAGE_STATUS_VALUES } from "@complaint-system/shared";
import { idParamSchema, objectIdSchema, paginationQuerySchema } from "./commonValidators";

export const createDraftPackageSchema = z.object({
  supplierName: z.string().trim().max(200).optional(),
});
export type CreateDraftPackageInput = z.infer<typeof createDraftPackageSchema>;

export const listPackagesQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.enum(PACKAGE_STATUS_VALUES as [string, ...string[]]).optional(),
  sortBy: z.enum(["createdAt", "lastActivityAt", "packageNumber"]).default("lastActivityAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListPackagesQuery = z.infer<typeof listPackagesQuerySchema>;

/** Multipart form fields alongside the uploaded photo -- values arrive as strings, hence z.coerce. */
export const receiveItemSchema = z.object({
  description: z.string().trim().max(500).optional(),
  variantLabel: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  notes: z.string().trim().max(1000).optional(),
});
export type ReceiveItemInput = z.infer<typeof receiveItemSchema>;

export const updateItemSchema = z.object({
  description: z.string().trim().max(500).optional(),
  variantLabel: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const matchItemSchema = z.object({
  productCode: z.string().trim().min(1).max(100),
});
export type MatchItemInput = z.infer<typeof matchItemSchema>;

export const changePackageStatusSchema = z.object({
  status: z.enum(PACKAGE_STATUS_VALUES as [string, ...string[]]),
  reason: z.string().max(1000).optional(),
});
export type ChangePackageStatusInput = z.infer<typeof changePackageStatusSchema>;

export const packageItemParamsSchema = idParamSchema.extend({
  itemId: objectIdSchema,
});
export type PackageItemParams = z.infer<typeof packageItemParamsSchema>;
