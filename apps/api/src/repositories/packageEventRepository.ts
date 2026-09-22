import type { ClientSession } from "mongoose";
import { PackageEventModel, type PackageEventDocument } from "../models/PackageEvent";

export interface CreatePackageEventData {
  packageId: string;
  type: string;
  actorId?: string | null;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

export const packageEventRepository = {
  async create(data: CreatePackageEventData, session?: ClientSession): Promise<PackageEventDocument> {
    const [doc] = await PackageEventModel.create([data], { session });
    return doc as PackageEventDocument;
  },

  async findRecent(limit: number): Promise<PackageEventDocument[]> {
    return PackageEventModel.find().sort({ createdAt: -1 }).limit(limit).populate("actorId", "name role");
  },

  async findByPackageId(packageId: string): Promise<PackageEventDocument[]> {
    return PackageEventModel.find({ packageId }).sort({ createdAt: 1 }).populate("actorId", "name role");
  },
};
