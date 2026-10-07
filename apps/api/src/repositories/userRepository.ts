import { UserModel, type UserDocument } from "../models/User";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  permissions: string[];
}

export const userRepository = {
  async listActive(): Promise<UserDocument[]> {
    return UserModel.find({ active: true }).sort({ name: 1 });
  },

  async listAll(): Promise<UserDocument[]> {
    return UserModel.find().sort({ name: 1 });
  },

  /** Active or not: for resolving the names behind stored user ids. */
  async findByIds(ids: string[]): Promise<UserDocument[]> {
    if (ids.length === 0) return [];
    return UserModel.find({ _id: { $in: ids } });
  },

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id);
  },

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).select("+passwordHash");
  },

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() });
  },

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
  },

  async create(data: CreateUserData): Promise<UserDocument> {
    return UserModel.create(data);
  },
};
