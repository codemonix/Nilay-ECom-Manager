import type { CaseDTO, CaseEventDTO, CaseListQuery } from "@complaint-system/shared";

export type { CaseDTO, CaseEventDTO, CaseListQuery };

export interface CaseListResult {
  items: CaseDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AttachmentDTO {
  id: string;
  caseId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface CreateCasePayload {
  customer: {
    externalCustomerId: string;
    name: string;
    phone?: string;
    email?: string;
  };
  subject: string;
  description: string;
  category: string;
  priority: string;
  source: string;
  assignedTo?: string;
  relatedOrder?: { externalOrderId: string; orderNumber: string };
  relatedItem?: { externalItemId: string; sku: string; title: string };
  tags?: string[];
}
