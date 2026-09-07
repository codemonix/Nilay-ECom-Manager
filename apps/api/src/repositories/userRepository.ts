import { UserModel, type UserDocument } from "../models/User";

export const userRepository = {
  async listActive(): Promise<UserDocument[]> {
    return UserModel.find({ active: true }).sort({ name: 1 });
  },

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id);
  },
};
