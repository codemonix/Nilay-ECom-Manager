import { z } from "zod";
import {
  CASE_CATEGORY_VALUES,
  CASE_PRIORITY_VALUES,
  CASE_SOURCE_VALUES,
  CASE_STATUS_VALUES,
} from "@complaint-system/shared";
import { objectIdSchema, paginationQuerySchema } from "./commonValidators";

export const customerSnapshotSchema = z.object({
  externalCustomerId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const createCaseSchema = z.object({
  customer: customerSnapshotSchema,
  subject: z.string().min(3).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum(CASE_CATEGORY_VALUES as [string, ...string[]]),
  priority: z.enum(CASE_PRIORITY_VALUES as [string, ...string[]]),
  source: z.enum(CASE_SOURCE_VALUES as [string, ...string[]]),
  assignedTo: objectIdSchema.optional(),
  relatedOrder: z
    .object({ externalOrderId: z.string().min(1), orderNumber: z.string().min(1) })
    .optional(),
  relatedItem: z
    .object({
      externalItemId: z.string().min(1),
      sku: z.string().min(1),
      title: z.string().min(1),
    })
    .optional(),
  tags: z.array(z.string().min(1)).optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const listCasesQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.enum(CASE_STATUS_VALUES as [string, ...string[]]).optional(),
  priority: z.enum(CASE_PRIORITY_VALUES as [string, ...string[]]).optional(),
  category: z.enum(CASE_CATEGORY_VALUES as [string, ...string[]]).optional(),
  assignedTo: objectIdSchema.optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "lastActivityAt", "priority", "status"]).default("lastActivityAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;

export const changeStatusSchema = z.object({
  status: z.enum(CASE_STATUS_VALUES as [string, ...string[]]),
  reason: z.string().max(1000).optional(),
});

export const changePrioritySchema = z.object({
  priority: z.enum(CASE_PRIORITY_VALUES as [string, ...string[]]),
});

export const assignCaseSchema = z.object({
  assignedTo: objectIdSchema.nullable(),
});

export const addNoteSchema = z.object({
  body: z.string().min(1).max(5000),
  visibility: z.enum(["internal", "customer"]).default("internal"),
});

export const linkOrderSchema = z.object({
  externalOrderId: z.string().min(1),
  orderNumber: z.string().min(1),
});

export const linkItemSchema = z.object({
  externalItemId: z.string().min(1),
  sku: z.string().min(1),
  title: z.string().min(1),
});

export const tagActionSchema = z.object({
  tag: z.string().min(1).max(40),
});
