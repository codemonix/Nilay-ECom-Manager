import type {
  CaseCategory,
  CaseEventType,
  CasePriority,
  CaseSource,
  CaseStatus,
} from "../constants/caseEnums";

/** Snapshot of external Shopfa customer data embedded on a Case for historical readability. */
export interface CaseCustomerSnapshot {
  externalCustomerId: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface CaseRelatedOrder {
  externalOrderId: string;
  orderNumber: string;
}

export interface CaseRelatedItem {
  externalItemId: string;
  sku: string;
  title: string;
}

export interface CaseDTO {
  id: string;
  caseNumber: string;
  customer: CaseCustomerSnapshot;
  subject: string;
  description: string;
  category: CaseCategory;
  priority: CasePriority;
  status: CaseStatus;
  source: CaseSource;
  assignedTo: { id: string; name: string } | null;
  relatedOrders: CaseRelatedOrder[];
  relatedItems: CaseRelatedItem[];
  tags: string[];
  lastActivityAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseEventDTO {
  id: string;
  caseId: string;
  type: CaseEventType;
  actor: { id: string; name: string } | null;
  body: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface CaseListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CaseStatus;
  priority?: CasePriority;
  category?: CaseCategory;
  assignedTo?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "lastActivityAt" | "priority" | "status";
  sortDir?: "asc" | "desc";
}
