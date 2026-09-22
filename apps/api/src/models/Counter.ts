import { Schema, model } from "mongoose";

/**
 * Generic named-sequence counter, used to generate human-friendly, gapless
 * per-day case numbers (e.g. C-20260903-0001) without exposing ObjectIds.
 */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const CounterModel = model("Counter", counterSchema);
