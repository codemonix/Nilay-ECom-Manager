import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { STAFF_ROLE_VALUES, MENU_KEY_VALUES, PERMISSION_KEY_VALUES } from "@complaint-system/shared";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: STAFF_ROLE_VALUES, required: true },
    active: { type: Boolean, default: true },
    permissions: { type: [String], enum: PERMISSION_KEY_VALUES, default: [] },
    quickAccessMenu: { type: [String], enum: MENU_KEY_VALUES, default: [] },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const UserModel = model("User", userSchema);
