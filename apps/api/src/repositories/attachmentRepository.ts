import { Types, type PipelineStage } from "mongoose";
import type { AttachmentSubjectType } from "@complaint-system/shared";
import { AttachmentModel, type AttachmentDocument } from "../models/Attachment";

export interface CreateAttachmentData {
  subjectType: AttachmentSubjectType;
  subjectId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedBy?: string | null;
}

/** Uploads of one subject type within a period, optionally by one user and/or limited to some subjects. */
export interface AttachmentUploadFilter {
  subjectType: AttachmentSubjectType;
  from: Date;
  to: Date;
  uploadedBy?: string;
  subjectIds?: string[];
}

/** What one user uploaded for one subject: `count` files, the first of them at `at`. */
export interface AttachmentUploadGroup {
  subjectId: string;
  uploadedBy: string | null;
  at: Date;
  count: number;
}

// An aggregation pipeline is not cast by mongoose the way a find() filter is, hence the explicit ObjectIds.
function uploadGroupStages(filter: AttachmentUploadFilter): PipelineStage[] {
  return [
    {
      $match: {
        subjectType: filter.subjectType,
        createdAt: { $gte: filter.from, $lte: filter.to },
        ...(filter.uploadedBy ? { uploadedBy: new Types.ObjectId(filter.uploadedBy) } : {}),
        ...(filter.subjectIds ? { subjectId: { $in: filter.subjectIds.map((id) => new Types.ObjectId(id)) } } : {}),
      },
    },
    { $group: { _id: { subjectId: "$subjectId", uploadedBy: "$uploadedBy" }, at: { $min: "$createdAt" }, count: { $sum: 1 } } },
  ];
}

export const attachmentRepository = {
  async create(data: CreateAttachmentData): Promise<AttachmentDocument> {
    return AttachmentModel.create(data);
  },

  async findBySubject(subjectType: AttachmentSubjectType, subjectId: string): Promise<AttachmentDocument[]> {
    return AttachmentModel.find({ subjectType, subjectId }).sort({ createdAt: -1 });
  },

  /** Batched form of findBySubject for a page of subjects at once (e.g. Packing history's list view), avoiding one query per row. */
  async findBySubjectIds(subjectType: AttachmentSubjectType, subjectIds: string[]): Promise<AttachmentDocument[]> {
    if (subjectIds.length === 0) return [];
    return AttachmentModel.find({ subjectType, subjectId: { $in: subjectIds } }).sort({ createdAt: -1 });
  },

  /** Uploads grouped per subject and uploader, newest first, at most `limit` groups. */
  async listUploadGroups(filter: AttachmentUploadFilter, limit: number): Promise<AttachmentUploadGroup[]> {
    const rows = await AttachmentModel.aggregate<{
      _id: { subjectId: Types.ObjectId; uploadedBy: Types.ObjectId | null };
      at: Date;
      count: number;
    }>([
      ...uploadGroupStages(filter),
      { $sort: { at: -1, "_id.subjectId": -1 } },
      { $limit: limit },
    ]);
    return rows.map((row) => ({
      subjectId: String(row._id.subjectId),
      uploadedBy: row._id.uploadedBy ? String(row._id.uploadedBy) : null,
      at: row.at,
      count: row.count,
    }));
  },

  async countUploadGroups(filter: AttachmentUploadFilter): Promise<number> {
    const rows = await AttachmentModel.aggregate<{ total: number }>([...uploadGroupStages(filter), { $count: "total" }]);
    return rows[0]?.total ?? 0;
  },

  /** Number of files each user uploaded. */
  async countUploadsByUploader(filter: AttachmentUploadFilter): Promise<{ uploadedBy: string | null; count: number }[]> {
    const rows = await AttachmentModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      uploadGroupStages(filter)[0]!,
      { $group: { _id: "$uploadedBy", count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ uploadedBy: row._id ? String(row._id) : null, count: row.count }));
  },
};
