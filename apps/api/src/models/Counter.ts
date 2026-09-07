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

export async function getNextSequence(key: string): Promise<number> {
  const result = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return result!.seq;
}
