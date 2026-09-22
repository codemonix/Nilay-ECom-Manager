import {
  AttachmentSubjectType,
  PACKING_CUSTOMER_PENDING_STATUS_CODES,
  PACKING_SENT_STATUS_CODE,
  PACKING_SOURCE_STATUS_CODE,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";
import type {
  PackingListResultDTO,
  PackingPendingOrderDTO,
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

function statusTitleForCode(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
}

/**
 * Every order in "ارسال شده به سرویس پستی" (created within the last `days`
 * days, or all of them when `days` is 0), ready for Packing's one-at-a-time queue -- see
 * ShopfaClient.listOrdersByStatusForPacking for why this bounds by order
 * *creation* date rather than when the order entered this status.
 */
export async function listOrdersForPacking(days: PackingRangeDays): Promise<PackingListResultDTO> {
  // days === 0 means all time: no window, so no order sitting in the status is ever hidden.
  const to = new Date();
  const window = days === 0 ? null : { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };

  const client = await getShopfaClient();
  const [statusOrders, statusTotal] = await Promise.all([
    client.listOrdersByStatusForPacking(PACKING_SOURCE_STATUS_CODE, window),
    client.countOrdersInStatus(PACKING_SOURCE_STATUS_CODE),
  ]);
  const orders = groupByCustomer(statusOrders);

  // The pending-orders flag is advisory: if this lookup fails, the queue itself must still load
  // (staff can pack regardless), so the failure is reported via pendingLookupFailed instead of thrown.
  const pendingByCustomer = new Map<string, PackingPendingOrderDTO[]>();
  let pendingLookupFailed = false;
  try {
    const refs = await client.listOrdersByStatusesForCustomerLookup(PACKING_CUSTOMER_PENDING_STATUS_CODES, window);
    for (const ref of refs) {
      const key = customerGroupKey(ref);
      const list = pendingByCustomer.get(key) ?? [];
      list.push({ orderNumber: ref.orderNumber, statusCode: ref.statusCode, statusTitle: ref.statusTitle });
      pendingByCustomer.set(key, list);
    }
  } catch (err) {
    pendingLookupFailed = true;
    logger.warn("Packing: could not look up customers' other pending orders", { err });
  }

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
      pendingOrders: pendingByCustomer.get(order.customerGroupKey) ?? [],
      customerGroupKey: order.customerGroupKey,
      orderDateISO: order.orderDate ? order.orderDate.toISOString() : null,
      statusCode: order.statusCode,
      statusTitle: order.statusTitle,
      items: order.items,
    })),
    pendingLookupFailed,
    generatedAtISO: new Date().toISOString(),
  };
}

export interface MarkOrderPackedSnapshot {
  externalOrderId: string;
  buyerName: string | null;
  items: PackingRecordItemDTO[];
}

/**
 * Moves an order to "ارسال شده" once every item has been physically packed
 * and confirmed -- no admin note involved, unlike Order Precheck. Also
 * writes a local PackingRecord (Shopfa itself keeps no browsable packing
 * history) with a denormalized snapshot of the order and, when provided, a
 * confirmation photo attached via the normal Attachment pipeline. `photos`
 * may be empty -- staff can explicitly "save and continue" without any via the
 * warning dialog, in which case the record simply has no photos.
 *
 * The Shopfa status write happens first; if the subsequent local history
 * write fails, the order is still correctly "ارسال شده" in Shopfa (the
 * system of record for order status) but missing from local history -- an
 * accepted, non-transactional gap rather than something this tries to roll
 * back, since Shopfa and MongoDB can't share a transaction.
 */
export async function markOrderPacked(
  orderNumber: string,
  snapshot: MarkOrderPackedSnapshot,
  photos: Express.Multer.File[],
  actor: PackingActor | undefined,
): Promise<SendPackedOrderResultDTO> {
  const client = await getShopfaClient();
  const result = await client.updateOrderStatus(orderNumber, PACKING_SENT_STATUS_CODE);
  if (!result) throw ApiError.notFound("Order not found");

  const record = await packingRecordRepository.create({
    externalOrderId: snapshot.externalOrderId,
    orderNumber: result.orderNumber,
    buyerName: snapshot.buyerName,
    items: snapshot.items,
    statusCodeAfterSend: result.statusCode,
    statusTitleAfterSend: result.statusTitle || statusTitleForCode(PACKING_SENT_STATUS_CODE),
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

  return {
    orderNumber: result.orderNumber,
    statusCode: result.statusCode,
    statusTitle: result.statusTitle || statusTitleForCode(PACKING_SENT_STATUS_CODE),
    packingRecordId: String(record._id),
    photoUrls,
  };
}

/**
 * Sends a whole customer group: every order is moved to "ارسال شده" and
 * recorded locally, and the group's confirmation photos are attached to each
 * order's record (same stored files, one Attachment per record) so each
 * order's history entry shows them. Orders are processed one by one and a
 * failure on one (e.g. a Shopfa timeout) doesn't stop the rest -- the result
 * lists which orders were sent and which failed so the caller can keep only
 * the failed ones in the queue.
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
    statusCodeAfterSend: obj.statusCodeAfterSend,
    statusTitleAfterSend: obj.statusTitleAfterSend,
    sentByName: obj.sentByName ?? null,
    sentAtISO: obj.sentAt.toISOString(),
    photoUrls,
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
