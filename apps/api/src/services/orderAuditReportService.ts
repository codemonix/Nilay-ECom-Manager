import { AttachmentSubjectType, OrderAuditEventType, ShopfaSyncStatus } from "@complaint-system/shared";
import type {
  OrderAuditEventDTO,
  OrderAuditReportResultDTO,
  OrderAuditUserSummaryDTO,
  OrderStatusChangeSource,
} from "@complaint-system/shared";
import type { OrderStatusChangeDocument } from "../models/OrderStatusChange";
import type { PackingRecordDocument } from "../models/PackingRecord";
import {
  attachmentRepository,
  type AttachmentUploadFilter,
  type AttachmentUploadGroup,
} from "../repositories/attachmentRepository";
import { orderStatusChangeRepository, type OrderAuditFilter } from "../repositories/orderStatusChangeRepository";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import { userRepository } from "../repositories/userRepository";
import { statusTitleForCode } from "./orderWorkflowService";
import { resolveDateWindow } from "./reportingService";
import { serializeAttachment } from "../utils/serializers";

export interface OrderAuditReportParams {
  from: string;
  to: string;
  userId?: string;
  orderNumber?: string;
  type?: OrderAuditEventType;
  page: number;
  pageSize: number;
}

/** An event before it is turned into its DTO: just enough to merge the three sources into one newest-first list. */
type Candidate =
  | { type: OrderAuditEventType.STATUS_CHANGED; at: Date; id: string; change: OrderStatusChangeDocument }
  | { type: OrderAuditEventType.ORDER_PACKED; at: Date; id: string; record: PackingRecordDocument }
  | { type: OrderAuditEventType.PHOTOS_UPLOADED; at: Date; id: string; upload: AttachmentUploadGroup };

/** Picture URLs per packing record and uploader, oldest first (attachments come back newest first). */
async function loadUploadedPhotoUrls(uploads: AttachmentUploadGroup[]): Promise<Map<string, string[]>> {
  const urls = new Map<string, string[]>();
  const attachments = await attachmentRepository.findBySubjectIds(
    AttachmentSubjectType.PACKING_RECORD,
    [...new Set(uploads.map((upload) => upload.subjectId))],
  );
  for (const attachment of [...attachments].reverse()) {
    const key = `${String(attachment.subjectId)}:${attachment.uploadedBy ? String(attachment.uploadedBy) : ""}`;
    const list = urls.get(key);
    if (list) list.push(serializeAttachment(attachment).url);
    else urls.set(key, [serializeAttachment(attachment).url]);
  }
  return urls;
}

/**
 * The Order Activity Log: every recorded staff action on an order within
 * the period -- status changes, packing sends and picture uploads -- merged
 * into one newest-first, paginated list, with per-user totals for the whole
 * period. Each source is read only as deep as the requested page needs.
 */
export async function buildOrderAuditReport(params: OrderAuditReportParams): Promise<OrderAuditReportResultDTO> {
  const { page, pageSize, type } = params;
  const window = resolveDateWindow(params.from, params.to);
  const filter: OrderAuditFilter = { ...window, userId: params.userId, orderNumber: params.orderNumber };
  const wants = (candidate: OrderAuditEventType) => type === undefined || type === candidate;
  const depth = page * pageSize;

  // Pictures hang off a packing record, not an order: an order filter becomes a filter on its packing records.
  const uploadFilter: AttachmentUploadFilter = {
    subjectType: AttachmentSubjectType.PACKING_RECORD,
    ...window,
    uploadedBy: params.userId,
    subjectIds: params.orderNumber
      ? (await packingRecordRepository.listByOrderNumber(params.orderNumber)).map((record) => String(record._id))
      : undefined,
  };

  const [changes, changeCount, changesByActor, records, recordCount, recordsByActor, uploads, uploadCount, photosByUploader] =
    await Promise.all([
      wants(OrderAuditEventType.STATUS_CHANGED) ? orderStatusChangeRepository.listForAudit(filter, depth) : [],
      wants(OrderAuditEventType.STATUS_CHANGED) ? orderStatusChangeRepository.countForAudit(filter) : 0,
      wants(OrderAuditEventType.STATUS_CHANGED) ? orderStatusChangeRepository.countForAuditByActor(filter) : [],
      wants(OrderAuditEventType.ORDER_PACKED) ? packingRecordRepository.listForAudit(filter, depth) : [],
      wants(OrderAuditEventType.ORDER_PACKED) ? packingRecordRepository.countForAudit(filter) : 0,
      wants(OrderAuditEventType.ORDER_PACKED) ? packingRecordRepository.countForAuditByActor(filter) : [],
      wants(OrderAuditEventType.PHOTOS_UPLOADED) ? attachmentRepository.listUploadGroups(uploadFilter, depth) : [],
      wants(OrderAuditEventType.PHOTOS_UPLOADED) ? attachmentRepository.countUploadGroups(uploadFilter) : 0,
      wants(OrderAuditEventType.PHOTOS_UPLOADED) ? attachmentRepository.countUploadsByUploader(uploadFilter) : [],
    ]);

  const candidates: Candidate[] = [
    ...changes.map((change): Candidate => ({
      type: OrderAuditEventType.STATUS_CHANGED,
      at: change.changedAt,
      id: String(change._id),
      change,
    })),
    ...records.map((record): Candidate => ({
      type: OrderAuditEventType.ORDER_PACKED,
      at: record.sentAt,
      id: String(record._id),
      record,
    })),
    ...uploads.map((upload): Candidate => ({
      type: OrderAuditEventType.PHOTOS_UPLOADED,
      at: upload.at,
      id: `${upload.subjectId}:${upload.uploadedBy ?? ""}`,
      upload,
    })),
  ];
  const pageCandidates = candidates
    .sort((a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id))
    .slice(depth - pageSize, depth);

  // Uploads only carry ids: resolve the order behind each packing record and the uploader's name.
  const pageUploads = pageCandidates.flatMap((candidate) =>
    candidate.type === OrderAuditEventType.PHOTOS_UPLOADED ? [candidate.upload] : [],
  );
  const uploaderIds = new Set<string>();
  for (const upload of pageUploads) if (upload.uploadedBy) uploaderIds.add(upload.uploadedBy);
  for (const row of photosByUploader) if (row.uploadedBy) uploaderIds.add(row.uploadedBy);
  const [uploadRecords, photoUrls, uploaders] = await Promise.all([
    packingRecordRepository.findByIds([...new Set(pageUploads.map((upload) => upload.subjectId))]),
    pageUploads.length > 0 ? loadUploadedPhotoUrls(pageUploads) : new Map<string, string[]>(),
    userRepository.findByIds([...uploaderIds]),
  ]);
  const orderNumberByRecordId = new Map(uploadRecords.map((record) => [String(record._id), record.orderNumber]));
  const userNameById = new Map(uploaders.map((user) => [String(user._id), user.name]));

  const events = pageCandidates.map((candidate): OrderAuditEventDTO => {
    const base = { id: `${candidate.type}:${candidate.id}`, atISO: candidate.at.toISOString() };
    switch (candidate.type) {
      case OrderAuditEventType.STATUS_CHANGED: {
        const { change } = candidate;
        const fromStatusCode = change.fromStatusCode ?? null;
        return {
          ...base,
          type: candidate.type,
          orderNumber: change.orderNumber,
          actorId: change.changedBy ? String(change.changedBy) : null,
          actorName: change.changedByName ?? null,
          fromStatusCode,
          fromStatusTitle: fromStatusCode === null ? null : statusTitleForCode(fromStatusCode),
          toStatusCode: change.toStatusCode,
          toStatusTitle: change.toStatusTitle,
          source: change.source as OrderStatusChangeSource,
        };
      }
      case OrderAuditEventType.ORDER_PACKED: {
        const { record } = candidate;
        return {
          ...base,
          type: candidate.type,
          orderNumber: record.orderNumber,
          actorId: record.sentBy ? String(record.sentBy) : null,
          actorName: record.sentByName ?? null,
          buyerName: record.buyerName ?? null,
          syncStatus: (record.syncStatus as ShopfaSyncStatus | undefined) ?? ShopfaSyncStatus.SYNCED,
        };
      }
      case OrderAuditEventType.PHOTOS_UPLOADED: {
        const { upload } = candidate;
        return {
          ...base,
          type: candidate.type,
          orderNumber: orderNumberByRecordId.get(upload.subjectId) ?? "",
          actorId: upload.uploadedBy,
          actorName: upload.uploadedBy ? (userNameById.get(upload.uploadedBy) ?? null) : null,
          photoUrls: photoUrls.get(candidate.id) ?? [],
        };
      }
    }
  });

  // One row per user: by id when the action stored one, else by the name snapshot.
  const summaryByActor = new Map<string, OrderAuditUserSummaryDTO>();
  const summaryRow = (actorId: string | null, actorName: string | null): OrderAuditUserSummaryDTO => {
    const key = actorId ?? `name:${actorName ?? ""}`;
    let row = summaryByActor.get(key);
    if (!row) {
      row = { actorId, actorName, statusChanges: 0, ordersPacked: 0, photosUploaded: 0 };
      summaryByActor.set(key, row);
    }
    row.actorName ??= actorName;
    return row;
  };
  for (const row of changesByActor) summaryRow(row.actorId, row.actorName).statusChanges += row.count;
  for (const row of recordsByActor) summaryRow(row.actorId, row.actorName).ordersPacked += row.count;
  for (const row of photosByUploader) {
    summaryRow(row.uploadedBy, row.uploadedBy ? (userNameById.get(row.uploadedBy) ?? null) : null).photosUploaded += row.count;
  }
  const activity = (row: OrderAuditUserSummaryDTO) => row.statusChanges + row.ordersPacked + row.photosUploaded;

  return {
    rangeFromISO: window.from.toISOString(),
    rangeToISO: window.to.toISOString(),
    page,
    pageSize,
    total: changeCount + recordCount + uploadCount,
    events,
    // Ties: named users alphabetically, the "unknown user" row last.
    summary: [...summaryByActor.values()].sort(
      (a, b) =>
        activity(b) - activity(a) ||
        Number(a.actorName === null) - Number(b.actorName === null) ||
        (a.actorName ?? "").localeCompare(b.actorName ?? ""),
    ),
    generatedAtISO: new Date().toISOString(),
  };
}
