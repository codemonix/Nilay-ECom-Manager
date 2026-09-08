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

/**
 * A single order/customer match surfaced while creating a case, from the
 * read-only Shopfa order search -- which transparently reads from either
 * the imported-orders collection or the live Shopfa API, depending on the
 * admin's Settings > Data Source choice.
 */
export interface MatchedCustomerOrderItem {
  externalItemId: string;
  sku: string;
  title: string;
  quantity: number;
}

export interface MatchedCustomerOrder {
  externalOrderId: string;
  orderNumber: string;
  externalCustomerId: string;
  customerName: string;
  customerPhone?: string;
  purchaseDate?: string | null;
  totalAmount?: number;
  items: MatchedCustomerOrderItem[];
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
  contactPoint?: { platform: string; contactId?: string };
  assignedTo?: string;
  relatedOrder?: { externalOrderId: string; orderNumber: string };
  relatedItems?: { externalItemId: string; sku: string; title: string }[];
  tags?: string[];
}
