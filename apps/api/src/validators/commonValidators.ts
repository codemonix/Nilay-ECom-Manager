import { z } from "zod";
import { Types } from "mongoose";

export const objectIdSchema = z.string().refine((v) => Types.ObjectId.isValid(v), {
  message: "Must be a valid identifier",
});

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
