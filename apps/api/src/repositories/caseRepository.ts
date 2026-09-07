import { Types, type ClientSession } from "mongoose";
import { CaseModel, type CaseDocument } from "../models/Case";
import type { ListCasesQuery } from "../validators/caseValidators";

export interface CreateCaseData {
  caseNumber: string;
  customer: { externalCustomerId: string; name: string; phone?: string; email?: string };
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  assignedTo?: string | null;
  relatedOrders?: Array<{ externalOrderId: string; orderNumber: string }>;
  relatedItems?: Array<{ externalItemId: string; sku: string; title: string }>;
  tags?: string[];
  createdBy?: string | null;
  lastActivityAt: Date;
}

export const caseRepository = {
  async create(data: CreateCaseData, session?: ClientSession): Promise<CaseDocument> {
    const [doc] = await CaseModel.create([data], { session });
    return doc as CaseDocument;
  },

  async findById(id: string, session?: ClientSession): Promise<CaseDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return CaseModel.findById(id).session(session ?? null).populate("assignedTo createdBy", "name email role");
  },

  async findByCaseNumber(caseNumber: string): Promise<CaseDocument | null> {
    return CaseModel.findOne({ caseNumber });
  },

  async list(query: ListCasesQuery) {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.category) filter.category = query.category;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.customerId) filter["customer.externalCustomerId"] = query.customerId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) createdAt.$lte = new Date(query.dateTo);
      filter.createdAt = createdAt;
    }

    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const sortDir = query.sortDir === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDir };

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      CaseModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.pageSize)
        .populate("assignedTo createdBy", "name email role"),
      CaseModel.countDocuments(filter),
    ]);

    return { items, total };
  },

  async save(doc: CaseDocument, session?: ClientSession): Promise<CaseDocument> {
    await doc.save({ session });
    return doc;
  },
};
