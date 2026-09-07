import type { ClientSession } from "mongoose";
import { CaseEventModel, type CaseEventDocument } from "../models/CaseEvent";

export interface CreateCaseEventData {
  caseId: string;
  type: string;
  actorId?: string | null;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

export const caseEventRepository = {
  async create(data: CreateCaseEventData, session?: ClientSession): Promise<CaseEventDocument> {
    const [doc] = await CaseEventModel.create([data], { session });
    return doc as CaseEventDocument;
  },

  async findByCaseId(caseId: string): Promise<CaseEventDocument[]> {
    return CaseEventModel.find({ caseId }).sort({ createdAt: 1 }).populate("actorId", "name role");
  },
};
