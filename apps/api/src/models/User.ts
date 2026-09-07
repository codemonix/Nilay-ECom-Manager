import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { STAFF_ROLE_VALUES } from "@complaint-system/shared";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    role: { type: String, enum: STAFF_ROLE_VALUES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const UserModel = model("User", userSchema);
