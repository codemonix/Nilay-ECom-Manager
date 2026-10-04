import { AttachmentSubjectType, ShopfaSyncStatus } from "@complaint-system/shared";
import type {
  CaseCategory,
  OrderActivitiesDTO,
  CasePriority,
  CaseStatus,
  OrderHistoryCaseDTO,
  OrderHistoryPackingDTO,
  OrderHistoryReportOrderDTO,
  OrderHistoryReportRangeDays,
  OrderHistoryReportResultDTO,
  OrderStatusChangeDTO,
  OrderStatusChangeSource,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import type { ShopfaStatusOrder } from "../integrations/shopfa/shopfaTypes";
import { caseRepository } from "../repositories/caseRepository";
import { orderStatusChangeRepository } from "../repositories/orderStatusChangeRepository";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import * as attachmentService from "./attachmentService";
import { normalizeCustomerQuery } from "./reportingService";
import { serializeAttachment } from "../utils/serializers";

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Attachment URLs per subject, in the order they were uploaded (attachments come back newest first). */
async function loadPhotoUrls(
  subjectType: AttachmentSubjectType,
  subjectIds: string[],
  imagesOnly: boolean,
): Promise<Map<string, string[]>> {
  const urlsBySubject = new Map<string, string[]>();
  if (subjectIds.length === 0) return urlsBySubject;
  const attachments = await attachmentService.listAttachmentsBySubjectIds(subjectType, subjectIds);
  for (const attachment of [...attachments].reverse()) {
    if (imagesOnly && !attachment.mimeType.startsWith("image/")) continue;
    pushTo(urlsBySubject, String(attachment.subjectId), serializeAttachment(attachment).url);
  }
  return urlsBySubject;
}

async function loadStatusChanges(orderNumbers: string[]): Promise<Map<string, OrderStatusChangeDTO[]>> {
  const byOrder = new Map<string, OrderStatusChangeDTO[]>();
  for (const change of await orderStatusChangeRepository.findByOrderNumbers(orderNumbers)) {
    pushTo(byOrder, change.orderNumber, {
      orderNumber: change.orderNumber,
      fromStatusCode: change.fromStatusCode ?? null,
      toStatusCode: change.toStatusCode,
      toStatusTitle: change.toStatusTitle,
      source: change.source as OrderStatusChangeSource,
      changedByName: change.changedByName ?? null,
      changedAtISO: change.changedAt.toISOString(),
    });
  }
  return byOrder;
}

async function loadPackings(orderNumbers: string[]): Promise<Map<string, OrderHistoryPackingDTO[]>> {
  const records = await packingRecordRepository.findByOrderNumbers(orderNumbers);
  const photoUrls = await loadPhotoUrls(
    AttachmentSubjectType.PACKING_RECORD,
    records.map((record) => String(record._id)),
    false,
  );
  const byOrder = new Map<string, OrderHistoryPackingDTO[]>();
  for (const record of records) {
    pushTo(byOrder, record.orderNumber, {
      packingRecordId: String(record._id),
      sentAtISO: record.sentAt.toISOString(),
      sentByName: record.sentByName ?? null,
      photoUrls: photoUrls.get(String(record._id)) ?? [],
      syncStatus: (record.syncStatus as ShopfaSyncStatus | undefined) ?? ShopfaSyncStatus.SYNCED,
      syncAttempts: record.syncAttempts ?? 0,
      lastSyncError: record.lastSyncError ?? null,
    });
  }
  return byOrder;
}

async function loadCases(orderNumbers: string[]): Promise<Map<string, OrderHistoryCaseDTO[]>> {
  const cases = await caseRepository.findByOrderNumbers(orderNumbers);
  const photoUrls = await loadPhotoUrls(
    AttachmentSubjectType.CASE,
    cases.map((caseDoc) => String(caseDoc._id)),
    true,
  );
  const wanted = new Set(orderNumbers);
  const byOrder = new Map<string, OrderHistoryCaseDTO[]>();
  for (const caseDoc of cases) {
    const dto: OrderHistoryCaseDTO = {
      id: String(caseDoc._id),
      caseNumber: caseDoc.caseNumber,
      subject: caseDoc.subject,
      status: caseDoc.status as CaseStatus,
      priority: caseDoc.priority as CasePriority,
      category: caseDoc.category as CaseCategory,
      createdAtISO: caseDoc.createdAt.toISOString(),
      photoUrls: photoUrls.get(String(caseDoc._id)) ?? [],
    };
    // A case can be linked to several orders; it shows under each one that is in this report.
    for (const linked of new Set(caseDoc.relatedOrders.map((order) => order.orderNumber))) {
      if (wanted.has(linked)) pushTo(byOrder, linked, dto);
    }
  }
  return byOrder;
}

/** Attaches everything this system recorded locally (status changes, packing passes and pictures, linked cases) to each live order. */
async function withHistory(orders: ShopfaStatusOrder[]): Promise<OrderHistoryReportOrderDTO[]> {
  const orderNumbers = orders.map((order) => order.orderNumber);
  const [statusChanges, packings, cases] = await Promise.all([
    loadStatusChanges(orderNumbers),
    loadPackings(orderNumbers),
    loadCases(orderNumbers),
  ]);
  return [...orders]
    .sort((a, b) => (b.updatedAt?.getTime() ?? -Infinity) - (a.updatedAt?.getTime() ?? -Infinity))
    .map((order) => ({
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerMobile: order.buyerMobile,
      orderDateISO: order.orderDate ? order.orderDate.toISOString() : null,
      paymentDateISO: order.paymentDate ? order.paymentDate.toISOString() : null,
      updatedAtISO: order.updatedAt ? order.updatedAt.toISOString() : null,
      statusCode: order.statusCode,
      statusTitle: order.statusTitle,
      shippingMethod: order.shippingMethod,
      itemCount: order.itemCount,
      totalQuantity: order.totalQuantity,
      statusChanges: statusChanges.get(order.orderNumber) ?? [],
      packings: packings.get(order.orderNumber) ?? [],
      cases: cases.get(order.orderNumber) ?? [],
    }));
}

/**
 * Order history by status: every order currently in `statusCode` that was
 * last updated within the last `days` days (all of them when `days` is 0) --
 * the same scan as Status Check (see ordersByStatusService) -- with each
 * order's recorded history.
 */
export async function buildOrderHistoryByStatus(
  statusCode: number,
  days: OrderHistoryReportRangeDays,
): Promise<OrderHistoryReportResultDTO> {
  const to = new Date();
  const window = days === 0 ? null : { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };
  const client = await getShopfaClient();
  const orders = await client.listOrdersByStatuses([statusCode], window);
  return {
    statusCode,
    days,
    rangeFromISO: window ? window.from.toISOString() : null,
    rangeToISO: window ? window.to.toISOString() : null,
    query: null,
    orders: await withHistory(orders),
    truncated: false,
    generatedAtISO: new Date().toISOString(),
  };
}

/** Order history by search: orders of any status and date matching a phone number, order number or customer name, with each order's recorded history. */
export async function buildOrderHistoryBySearch(query: string): Promise<OrderHistoryReportResultDTO> {
  const normalizedQuery = normalizeCustomerQuery(query);
  const client = await getShopfaClient();
  const { orders, truncated } = await client.searchOrdersForHistory(normalizedQuery);
  return {
    statusCode: null,
    days: null,
    rangeFromISO: null,
    rangeToISO: null,
    query: normalizedQuery,
    orders: await withHistory(orders),
    truncated,
    generatedAtISO: new Date().toISOString(),
  };
}

/** Shopfa's own activity log for one order (what its panel shows under "نمایش فعالیت ها"), oldest first -- see ShopfaClient.listOrderActivities. */
export async function getOrderActivities(orderNumber: string): Promise<OrderActivitiesDTO> {
  const client = await getShopfaClient();
  const { activities, truncated } = await client.listOrderActivities(orderNumber);
  return {
    orderNumber,
    activities: activities.map((activity) => ({
      id: activity.id,
      event: activity.event,
      statusTitle: activity.statusTitle,
      atISO: activity.at ? activity.at.toISOString() : null,
      actorName: activity.actorName,
    })),
    truncated,
  };
}
