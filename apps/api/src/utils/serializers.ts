import type { CaseDocument } from "../models/Case";
import type { CaseEventDocument } from "../models/CaseEvent";
import type { AttachmentDocument } from "../models/Attachment";
import type { UserDocument } from "../models/User";
import type { SystemLogDocument } from "../models/SystemLog";
import type { UserActivityLogDocument } from "../models/UserActivityLog";
import type { ShopfaTransactionLogDocument } from "../models/ShopfaTransactionLog";

type PopulatedRef = { _id: unknown; name: string; role?: string } | null | undefined;

function refToSummary(ref: PopulatedRef): { id: string; name: string } | null {
  if (!ref || typeof ref !== "object" || !("name" in ref)) return null;
  return { id: String(ref._id), name: ref.name };
}

export function serializeCase(caseDoc: CaseDocument) {
  const obj = caseDoc.toObject({ virtuals: false });
  return {
    id: String(obj._id),
    caseNumber: obj.caseNumber,
    customer: obj.customer,
    subject: obj.subject,
    description: obj.description,
    category: obj.category,
    priority: obj.priority,
    status: obj.status,
    source: obj.source,
    contactPoint: obj.contactPoint ?? null,
    assignedTo: refToSummary(obj.assignedTo as unknown as PopulatedRef),
    relatedOrders: obj.relatedOrders,
    relatedItems: obj.relatedItems,
    tags: obj.tags,
    lastActivityAt: obj.lastActivityAt,
    resolvedAt: obj.resolvedAt,
    closedAt: obj.closedAt,
    createdBy: refToSummary(obj.createdBy as unknown as PopulatedRef),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export function serializeCaseEvent(event: CaseEventDocument) {
  const obj = event.toObject({ virtuals: false });
  return {
    id: String(obj._id),
    caseId: String(obj.caseId),
    type: obj.type,
    actor: refToSummary(obj.actorId as unknown as PopulatedRef),
    body: obj.body,
    data: obj.data,
    createdAt: obj.createdAt,
  };
}

export function serializeAttachment(attachment: AttachmentDocument) {
  const obj = attachment.toObject();
  return {
    id: String(obj._id),
    caseId: String(obj.caseId),
    originalFilename: obj.originalFilename,
    storedFilename: obj.storedFilename,
    mimeType: obj.mimeType,
    size: obj.size,
    url: `/uploads/${obj.storedFilename}`,
    uploadedBy: obj.uploadedBy ? String(obj.uploadedBy) : null,
    createdAt: obj.createdAt,
  };
}

export function serializeUser(user: UserDocument) {
  const obj = user.toObject();
  return {
    id: String(obj._id),
    name: obj.name,
    email: obj.email,
    role: obj.role,
    active: obj.active,
    permissions: obj.permissions ?? [],
  };
}

export function serializeSystemLog(log: SystemLogDocument) {
  const obj = log.toObject();
  return {
    id: String(obj._id),
    level: obj.level,
    message: obj.message,
    context: obj.context ?? null,
    meta: obj.meta ?? null,
    createdAt: obj.createdAt,
  };
}

export function serializeUserActivityLog(log: UserActivityLogDocument) {
  const obj = log.toObject();
  return {
    id: String(obj._id),
    userId: obj.userId ? String(obj.userId) : null,
    userName: obj.userName,
    userRole: obj.userRole,
    method: obj.method,
    path: obj.path,
    statusCode: obj.statusCode,
    durationMs: obj.durationMs,
    ip: obj.ip ?? null,
    createdAt: obj.createdAt,
  };
}

export function serializeShopfaTransactionLog(log: ShopfaTransactionLogDocument) {
  const obj = log.toObject();
  return {
    id: String(obj._id),
    method: obj.method,
    endpoint: obj.endpoint,
    requestParams: obj.requestParams ?? null,
    statusCode: obj.statusCode ?? null,
    success: obj.success,
    durationMs: obj.durationMs,
    errorMessage: obj.errorMessage ?? null,
    createdAt: obj.createdAt,
  };
}
