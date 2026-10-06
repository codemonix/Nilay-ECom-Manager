import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * One outbound call to the live Shopfa HTTP API, recorded by the axios
 * interceptors in integrations/shopfa/shopfaClient.ts -- independent of
 * UserActivityLog and SystemLog. requestParams is stored with `private_key`
 * stripped out (see shopfaClient.ts) so the API token never ends up at rest
 * in the database. requestBody/responseBody are only populated while
 * Settings.systemLogLevel is "debug" (see shopfaClient.ts's logTransaction),
 * since the full JSON body of every Shopfa call is far more data than this
 * collection needs to keep around at normal verbosity.
 */
const shopfaTransactionLogSchema = new Schema(
  {
    method: { type: String, required: true },
    endpoint: { type: String, required: true },
    requestParams: { type: Schema.Types.Mixed, default: null },
    requestBody: { type: Schema.Types.Mixed, default: null },
    responseBody: { type: Schema.Types.Mixed, default: null },
    statusCode: { type: Number, default: null },
    success: { type: Boolean, required: true },
    durationMs: { type: Number, required: true },
    errorMessage: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

shopfaTransactionLogSchema.index({ createdAt: -1 });
shopfaTransactionLogSchema.index({ success: 1, createdAt: -1 });

export type ShopfaTransactionLogSchemaType = InferSchemaType<typeof shopfaTransactionLogSchema>;
export type ShopfaTransactionLogDocument = HydratedDocument<ShopfaTransactionLogSchemaType>;
export const ShopfaTransactionLogModel = model("ShopfaTransactionLog", shopfaTransactionLogSchema);
