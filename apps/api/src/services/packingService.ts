import {
  AttachmentSubjectType,
  PACKING_SENT_STATUS_CODE,
  PACKING_SOURCE_STATUS_CODE,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";
import type {
  PackingListResultDTO,
  PackingRangeDays,
  PackingRecordDTO,
  PackingRecordItemDTO,
  SendPackedOrderResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import * as attachmentService from "./attachmentService";
import { serializeAttachment } from "../utils/serializers";
import type { PackingRecordDocument } from "../models/PackingRecord";
import { ApiError } from "../utils/ApiError";

export interface PackingActor {
  id: string;
  name: string;
}

function statusTitleForCode(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
}

/**
 * Every order in "ارسال شده به سرویس پستی" created within the last `days`
 * days, ready for Packing's one-at-a-time queue -- see
 * ShopfaClient.listOrdersByStatusForPacking for why this bounds by order
 * *creation* date rather than when the order entered this status.
 */
export async function listOrdersForPacking(days: PackingRangeDays): Promise<PackingListResultDTO> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const client = await getShopfaClient();
  const orders = await client.listOrdersByStatusForPacking(PACKING_SOURCE_STATUS_CODE, { from, to });

  return {
    days,
    rangeFromISO: from.toISOString(),
    rangeToISO: to.toISOString(),
    orders: orders.map((order) => ({
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      orderDateISO: order.orderDate ? order.orderDate.toISOString() : null,
      statusCode: order.statusCode,
      statusTitle: order.statusTitle,
      items: order.items,
    })),
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
 * confirmation photo attached via the normal Attachment pipeline. `photo`
 * is optional -- staff can explicitly send without one via the warning
 * dialog's "Confirm" override, in which case the record's photo stays null.
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
  photo: Express.Multer.File | undefined,
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

  let photoUrl: string | null = null;
  if (photo) {
    const attachment = await attachmentService.addAttachment(
      AttachmentSubjectType.PACKING_RECORD,
      String(record._id),
      photo,
      actor,
    );
    photoUrl = serializeAttachment(attachment).url;
  }

  return {
    orderNumber: result.orderNumber,
    statusCode: result.statusCode,
    statusTitle: result.statusTitle || statusTitleForCode(PACKING_SENT_STATUS_CODE),
    packingRecordId: String(record._id),
    photoUrl,
  };
}

function serializePackingRecord(doc: PackingRecordDocument, photoUrl: string | null): PackingRecordDTO {
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
    photoUrl,
  };
}

/** Paginated packing history -- every order Packing has ever sent, newest first, with its confirmation photo (when one was taken). */
export async function listPackingHistory(params: { page: number; pageSize: number; search?: string }) {
  const { items, total } = await packingRecordRepository.list(params);
  const recordIds = items.map((doc) => String(doc._id));
  const attachments = await attachmentService.listAttachmentsBySubjectIds(AttachmentSubjectType.PACKING_RECORD, recordIds);
  const photoUrlByRecordId = new Map<string, string>();
  for (const attachment of attachments) {
    const recordId = String(attachment.subjectId);
    if (!photoUrlByRecordId.has(recordId)) photoUrlByRecordId.set(recordId, serializeAttachment(attachment).url);
  }

  return {
    items: items.map((doc) => serializePackingRecord(doc, photoUrlByRecordId.get(String(doc._id)) ?? null)),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
