import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import {
  CASE_CATEGORY_VALUES,
  CASE_CONTACT_PLATFORM_VALUES,
  CASE_PRIORITY_VALUES,
  CASE_SOURCE_VALUES,
  CASE_STATUS_VALUES,
  CaseStatus,
  CasePriority,
} from "@complaint-system/shared";

const customerSnapshotSchema = new Schema(
  {
    externalCustomerId: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
  },
  { _id: false },
);

const relatedOrderSchema = new Schema(
  {
    externalOrderId: { type: String, required: true },
    orderNumber: { type: String, required: true },
  },
  { _id: false },
);

const relatedItemSchema = new Schema(
  {
    externalItemId: { type: String, required: true },
    sku: { type: String, required: true },
    title: { type: String, required: true },
  },
  { _id: false },
);

const contactPointSchema = new Schema(
  {
    platform: { type: String, enum: CASE_CONTACT_PLATFORM_VALUES, required: true },
    contactId: { type: String, trim: true },
  },
  { _id: false },
);

const caseSchema = new Schema(
  {
    caseNumber: { type: String, required: true, unique: true },

    customer: { type: customerSnapshotSchema, required: true },

    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    category: { type: String, enum: CASE_CATEGORY_VALUES, required: true },
    priority: {
      type: String,
      enum: CASE_PRIORITY_VALUES,
      required: true,
      default: CasePriority.NORMAL,
    },
    status: {
      type: String,
      enum: CASE_STATUS_VALUES,
      required: true,
      default: CaseStatus.OPEN,
    },
    source: { type: String, enum: CASE_SOURCE_VALUES, required: true },
    contactPoint: { type: contactPointSchema, default: null },

    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },

    relatedOrders: { type: [relatedOrderSchema], default: [] },
    relatedItems: { type: [relatedItemSchema], default: [] },
    tags: { type: [String], default: [] },

    lastActivityAt: { type: Date, required: true, default: () => new Date() },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

caseSchema.index({ "customer.externalCustomerId": 1 });
caseSchema.index({ status: 1, priority: 1, lastActivityAt: -1 });
caseSchema.index({ assignedTo: 1, status: 1, lastActivityAt: -1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ subject: "text", description: "text", caseNumber: "text" });

export type CaseSchemaType = InferSchemaType<typeof caseSchema>;
export type CaseDocument = HydratedDocument<CaseSchemaType> & { _id: Types.ObjectId };
export const CaseModel = model("Case", caseSchema);
