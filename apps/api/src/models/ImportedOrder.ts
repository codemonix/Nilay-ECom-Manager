import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";

const importedOrderItemSchema = new Schema(
  {
    productCode: { type: String, required: true },
    sku: { type: String },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true, default: 0 },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const importedOrderBuyerSchema = new Schema(
  {
    externalBuyerId: { type: String, required: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    province: { type: String },
    city: { type: String },
    address: { type: String },
    postalCode: { type: String },
    mobile: { type: String },
    landline: { type: String },
    nationalId: { type: String },
  },
  { _id: false },
);

/**
 * An order imported from a Shopfa xlsx export (see services/orderImportService.ts).
 * One row per row-group sharing the same order code in the source file, with
 * `items` collecting every line item of that order. This is our local,
 * disposable mirror of Shopfa order data for use until live API access is
 * available -- see docs/architecture.md#shopfa-integration for how it's
 * plugged into the ShopfaClient abstraction.
 */
const importedOrderSchema = new Schema(
  {
    externalOrderId: { type: String, required: true, unique: true },
    status: { type: String, required: true },
    purchaseDate: { type: Date, default: null },
    paymentMethod: { type: String },
    paymentDate: { type: String },
    shippingMethod: { type: String },
    shippingCost: { type: Number, required: true, default: 0 },
    buyer: { type: importedOrderBuyerSchema, required: true },
    cartWeight: { type: Number },
    shipmentCode: { type: String },
    discountCode: { type: String },
    discountAmount: { type: Number, required: true, default: 0 },
    userMessage: { type: String },
    adminNote: { type: String },
    purchasePath: { type: String },
    items: { type: [importedOrderItemSchema], default: [] },
    itemsTotal: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    importedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

importedOrderSchema.index({ "buyer.externalBuyerId": 1 });
importedOrderSchema.index({ purchaseDate: -1 });

export type ImportedOrderSchemaType = InferSchemaType<typeof importedOrderSchema>;
export type ImportedOrderDocument = HydratedDocument<ImportedOrderSchemaType> & { _id: Types.ObjectId };
export const ImportedOrderModel = model("ImportedOrder", importedOrderSchema);
