import { AttachmentSubjectType, PACKING_SOURCE_STATUS_CODE, ShopfaSyncStatus } from "@complaint-system/shared";
import type {
  PackingCustomerOrdersDTO,
  PackingListResultDTO,
  PackingRangeDays,
  PackingRecordDTO,
  PackingRecordItemDTO,
  SendPackedOrderResultDTO,
  SendPackedOrdersResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import * as attachmentService from "./attachmentService";
import { serializeAttachment } from "../utils/serializers";
import type { PackingRecordDocument } from "../models/PackingRecord";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { customerGroupKey } from "../utils/customerMatching";
import { findCustomerSiblingOrders } from "./orderWorkflowService";
import * as packingSyncService from "./packingSyncService";

export interface PackingActor {
  id: string;
  name: string;
}

/**
 * Queue order for Packing: one customer's orders are kept together (so they
 * can be boxed together), groups are ordered by their oldest-paid order
 * (orders paid earliest still have to ship first), and inside a group orders
 * are sorted oldest payment first. Payment date falls back
 * to creation date, and fully undated orders sort last.
 */
function groupByCustomer<
  T extends { paymentDate: Date | null; orderDate: Date | null; buyerMobile: string | null; buyerName: string | null; orderNumber: string },
>(orders: T[]): (T & { customerGroupKey: string })[] {
  const time = (order: T) => (order.paymentDate ?? order.orderDate)?.getTime() ?? Infinity;
  const withKey = orders.map((order) => ({ ...order, customerGroupKey: customerGroupKey(order) }));
  const groupOldest = new Map<string, number>();
  for (const order of withKey) {
    groupOldest.set(order.customerGroupKey, Math.min(groupOldest.get(order.customerGroupKey) ?? Infinity, time(order)));
  }
  return withKey.sort((a, b) => {
    if (a.customerGroupKey !== b.customerGroupKey) {
      const diff = groupOldest.get(a.customerGroupKey)! - groupOldest.get(b.customerGroupKey)!;
      return diff !== 0 ? diff : a.customerGroupKey.localeCompare(b.customerGroupKey);
    }
    return time(a) - time(b);
  });
}

/**
 * Every order in "ارسال شده به سرویس پستی" (created within the last `days`
 * days, or all of them when `days` is 0), ready for Packing's one-at-a-time queue -- see
 * ShopfaClient.listOrdersByStatusForPacking for why this bounds by order
 * *creation* date rather than when the order entered this status.
 *
 * Orders already packed here whose Shopfa push hasn't gone through yet
 * (PENDING_SYNC, being retried) or gave up (FAILED) are still in this status
 * on Shopfa, but are physically packed -- they're left out of the queue so
 * they aren't packed twice, and FAILED ones are listed in `failedSyncs` for a
 * manual retry.
 */
export async function listOrdersForPacking(days: PackingRangeDays): Promise<PackingListResultDTO> {
  // days === 0 means all time: no window, so no order sitting in the status is ever hidden.
  const to = new Date();
  const window = days === 0 ? null : { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };

  const client = await getShopfaClient();
  const [statusOrders, statusTotal, unsynced] = await Promise.all([
    client.listOrdersByStatusForPacking(PACKING_SOURCE_STATUS_CODE, window),
    client.countOrdersInStatus(PACKING_SOURCE_STATUS_CODE),
    packingRecordRepository.listUnsynced(),
  ]);
  const unsyncedOrderNumbers = new Set(unsynced.map((record) => record.orderNumber));
  const orders = groupByCustomer(statusOrders.filter((order) => !unsyncedOrderNumbers.has(order.orderNumber)));
  const failed = unsynced.filter((record) => record.syncStatus === ShopfaSyncStatus.FAILED);

  return {
    days,
    rangeFromISO: window ? window.from.toISOString() : null,
    rangeToISO: window ? window.to.toISOString() : null,
    statusTotal,
    orders: orders.map((order) => ({
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerMobile: order.buyerMobile ?? null,
      shippingMethod: order.shippingMethod ?? null,
      customerGroupKey: order.customerGroupKey,
      orderDateISO: order.orderDate ? order.orderDate.toISOString() : null,
      statusCode: order.statusCode,
      statusTitle: order.statusTitle,
      items: order.items,
    })),
    failedSyncs: failed.map((record) => ({
      packingRecordId: String(record._id),
      orderNumber: record.orderNumber,
      buyerName: record.buyerName ?? null,
      lastSyncError: record.lastSyncError ?? null,
      sentAtISO: record.sentAt.toISOString(),
    })),
    pendingSyncCount: unsynced.length - failed.length,
    generatedAtISO: new Date().toISOString(),
  };
}

/**
 * Opening a customer group: the customer's orders in any status other than
 * "ارسال شده به سرویس پستی" (those are the group itself), leaving out
 * shipped/cancelled ones -- purely informational, it never blocks packing.
 */
export async function getPackingCustomerOrders(orderNumber: string): Promise<PackingCustomerOrdersDTO> {
  const client = await getShopfaClient();
  const details = await client.getOrderDetailsByNumber(orderNumber);
  if (!details) throw ApiError.notFound("Order not found");
  const siblings = await findCustomerSiblingOrders(client, {
    orderNumber,
    buyerMobile: details.buyerMobile,
    buyerName: details.buyerName,
  });
  return {
    orderNumber,
    otherStatusOrders: siblings
      .filter((order) => order.statusCode !== PACKING_SOURCE_STATUS_CODE)
      .map((order) => ({ orderNumber: order.orderNumber, statusCode: order.statusCode, statusTitle: order.statusTitle })),
  };
}

export interface MarkOrderPackedSnapshot {
  externalOrderId: string;
  buyerName: string | null;
  items: PackingRecordItemDTO[];
}

/**
 * Finalizes one packed order: a local PackingRecord is written first (a
 * denormalized snapshot of the order -- Shopfa itself keeps no browsable
 * packing history) with the group's confirmation photos attached via the
 * normal Attachment pipeline, then the order is pushed to Shopfa as
 * "ارسال شده" with the photo count in its admin note (see
 * packingSyncService). `photos` may be empty -- staff can explicitly confirm
 * the save without any.
 *
 * A failed push doesn't fail the send: the order is packed either way, so
 * the record stays PENDING_SYNC and the background worker retries it
 * (the result's `syncStatus` says which happened).
 */
export async function markOrderPacked(
  orderNumber: string,
  snapshot: MarkOrderPackedSnapshot,
  photos: Express.Multer.File[],
  actor: PackingActor | undefined,
): Promise<SendPackedOrderResultDTO> {
  const record = await packingRecordRepository.create({
    externalOrderId: snapshot.externalOrderId,
    orderNumber,
    buyerName: snapshot.buyerName,
    items: snapshot.items,
    photoCount: photos.length,
    syncStatus: ShopfaSyncStatus.PENDING_SYNC,
    nextSyncAt: packingSyncService.newRecordLease(),
    sentBy: actor?.id ?? null,
    sentByName: actor?.name ?? null,
    sentAt: new Date(),
  });

  const photoUrls: string[] = [];
  for (const photo of photos) {
    const attachment = await attachmentService.addAttachment(
      AttachmentSubjectType.PACKING_RECORD,
      String(record._id),
      photo,
      actor,
    );
    photoUrls.push(serializeAttachment(attachment).url);
  }

  const pushed = await packingSyncService.pushNewRecord(record);
  return {
    orderNumber,
    packingRecordId: String(record._id),
    photoUrls,
    syncStatus: pushed.syncStatus as ShopfaSyncStatus,
  };
}

/** Manual "retry now" for a packed order whose Shopfa push is pending or gave up. */
export async function retryPackingSync(recordId: string): Promise<SendPackedOrderResultDTO> {
  const record = await packingSyncService.retryRecord(recordId);
  return {
    orderNumber: record.orderNumber,
    packingRecordId: String(record._id),
    photoUrls: [],
    syncStatus: record.syncStatus as ShopfaSyncStatus,
  };
}

/**
 * Sends a whole customer group (Packing's Save): every order is recorded
 * locally and pushed to Shopfa as "ارسال شده", and the group's confirmation
 * photos are attached to each order's record (same stored files, one
 * Attachment per record) so each order's history entry shows them. Orders are
 * processed one by one; a Shopfa failure only leaves that order PENDING_SYNC
 * (see markOrderPacked), and only a local failure (the record couldn't be
 * written) lands it in `failed` so the caller keeps it in the queue.
 */
export async function markOrdersPacked(
  orders: (MarkOrderPackedSnapshot & { orderNumber: string })[],
  photos: Express.Multer.File[],
  actor: PackingActor | undefined,
): Promise<SendPackedOrdersResultDTO> {
  const sent: SendPackedOrderResultDTO[] = [];
  const failed: SendPackedOrdersResultDTO["failed"] = [];
  for (const order of orders) {
    try {
      sent.push(await markOrderPacked(order.orderNumber, order, photos, actor));
    } catch (err) {
      logger.error("Packing: failed to send order", { orderNumber: order.orderNumber, err });
      failed.push({ orderNumber: order.orderNumber, message: err instanceof ApiError ? err.message : "Unexpected error" });
    }
  }
  return { sent, failed };
}

function serializePackingRecord(doc: PackingRecordDocument, photoUrls: string[]): PackingRecordDTO {
  const obj = doc.toObject();
  return {
    id: String(obj._id),
    externalOrderId: obj.externalOrderId,
    orderNumber: obj.orderNumber,
    buyerName: obj.buyerName ?? null,
    items: obj.items.map((item) => ({ productCode: item.productCode, title: item.title, quantity: item.quantity })),
    statusCodeAfterSend: obj.statusCodeAfterSend ?? null,
    statusTitleAfterSend: obj.statusTitleAfterSend ?? null,
    sentByName: obj.sentByName ?? null,
    sentAtISO: obj.sentAt.toISOString(),
    photoUrls,
    syncStatus: (obj.syncStatus as ShopfaSyncStatus | undefined) ?? ShopfaSyncStatus.SYNCED,
    syncAttempts: obj.syncAttempts ?? 0,
    lastSyncError: obj.lastSyncError ?? null,
  };
}

/** Paginated packing history -- every order Packing has ever sent, newest first, with its confirmation photos (when any were taken). */
export async function listPackingHistory(params: { page: number; pageSize: number; search?: string }) {
  const { items, total } = await packingRecordRepository.list(params);
  const recordIds = items.map((doc) => String(doc._id));
  const attachments = await attachmentService.listAttachmentsBySubjectIds(AttachmentSubjectType.PACKING_RECORD, recordIds);
  // Attachments come back newest first; history shows photos in the order they were taken.
  const photoUrlsByRecordId = new Map<string, string[]>();
  for (const attachment of [...attachments].reverse()) {
    const recordId = String(attachment.subjectId);
    photoUrlsByRecordId.set(recordId, [...(photoUrlsByRecordId.get(recordId) ?? []), serializeAttachment(attachment).url]);
  }

  return {
    items: items.map((doc) => serializePackingRecord(doc, photoUrlsByRecordId.get(String(doc._id)) ?? [])),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
