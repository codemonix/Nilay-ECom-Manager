import { CounterModel } from "../models/Counter";

export const counterRepository = {
  async getNextSequence(key: string): Promise<number> {
    const result = await CounterModel.findByIdAndUpdate(
      key,
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    ).lean();
    return result!.seq;
  },
};
