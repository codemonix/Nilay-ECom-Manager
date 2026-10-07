import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";
import { OrderStatusChangeSource } from "@complaint-system/shared";

/**
 * Local audit log of every Shopfa order status change this system makes
 * (Order Precheck and Packing) -- Shopfa's API exposes no status history of
 * its own. Written only after Shopfa confirmed the change, so it never
 * records a change that didn't happen. See orderWorkflowService.getOrderHistory.
 */
const orderStatusChangeSchema = new Schema(
  {
    orderNumber: { type: String, required: true, index: true },
    /** Null when the status before the change wasn't known (e.g. a related order changed without a prior read). */
    fromStatusCode: { type: Number, default: null },
    toStatusCode: { type: Number, required: true },
    toStatusTitle: { type: String, required: true },
    source: { type: String, enum: Object.values(OrderStatusChangeSource), required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedByName: { type: String, default: null },
    changedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

orderStatusChangeSchema.index({ changedAt: -1 });

export type OrderStatusChangeSchemaType = InferSchemaType<typeof orderStatusChangeSchema>;
export type OrderStatusChangeDocument = HydratedDocument<OrderStatusChangeSchemaType> & { _id: Types.ObjectId };
export const OrderStatusChangeModel = model("OrderStatusChange", orderStatusChangeSchema);
