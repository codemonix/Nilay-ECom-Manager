import { Types, type ClientSession } from "mongoose";
import { PackageModel, type PackageDocument } from "../models/Package";
import type { ListPackagesQuery } from "../validators/packageValidators";

export interface CreatePackageData {
  packageNumber: string;
  supplierName?: string | null;
  createdBy?: string | null;
  lastActivityAt: Date;
}

export const packageRepository = {
  async countByStatus(): Promise<{ _id: string; count: number }[]> {
    return PackageModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  },

  async countItemsPendingMatch(): Promise<number> {
    const [row] = await PackageModel.aggregate<{ count: number }>([
      { $unwind: "$items" },
      { $match: { "items.matchedAt": null } },
      { $count: "count" },
    ]);
    return row?.count ?? 0;
  },

  async countItemsPendingInventoryDecision(): Promise<number> {
    const [row] = await PackageModel.aggregate<{ count: number }>([
      { $unwind: "$items" },
      { $match: { "items.inventoryPending": true } },
      { $count: "count" },
    ]);
    return row?.count ?? 0;
  },

  async create(data: CreatePackageData, session?: ClientSession): Promise<PackageDocument> {
    const [doc] = await PackageModel.create([data], { session });
    return doc as PackageDocument;
  },

  async findById(id: string, session?: ClientSession): Promise<PackageDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return PackageModel.findById(id)
      .session(session ?? null)
      .populate("createdBy", "name email role")
      .populate("receivedBy", "name email role");
  },

  async findByPackageNumber(packageNumber: string): Promise<PackageDocument | null> {
    return PackageModel.findOne({ packageNumber });
  },

  /** Any package still in DRAFT -- Receive Items appends to whichever one is returned (one shared draft, no per-user ownership). */
  async findOpenDraft(session?: ClientSession): Promise<PackageDocument | null> {
    return PackageModel.findOne({ status: "draft" })
      .session(session ?? null)
      .sort({ createdAt: -1 });
  },

  async list(query: ListPackagesQuery) {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.packageNumber = { $regex: query.search.trim(), $options: "i" };
    }

    const sortDir = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDir };

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      PackageModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.pageSize)
        .populate("createdBy", "name email role")
        .populate("receivedBy", "name email role"),
      PackageModel.countDocuments(filter),
    ]);

    return { items, total };
  },

  async save(doc: PackageDocument, session?: ClientSession): Promise<PackageDocument> {
    await doc.save({ session });
    return doc;
  },
};
