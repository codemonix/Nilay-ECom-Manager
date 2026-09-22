import { AttachmentSubjectType, SHOPFA_ORDER_STATUS_OPTIONS } from "@complaint-system/shared";
import type { OrdersByStatusRangeDays, OrdersByStatusResultDTO } from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import * as attachmentService from "./attachmentService";
import { serializeAttachment } from "../utils/serializers";

function statusTitleForCode(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
}

/**
 * For each order number, the final Packing pictures of its most recent
 * packing record that has any (oldest picture first). Orders that never went
 * through Packing, or were sent without a picture, are simply absent.
 */
async function loadPackingPhotos(orderNumbers: string[]): Promise<Map<string, string[]>> {
  const records = await packingRecordRepository.findByOrderNumbers(orderNumbers);
  if (records.length === 0) return new Map();

  const attachments = await attachmentService.listAttachmentsBySubjectIds(
    AttachmentSubjectType.PACKING_RECORD,
    records.map((record) => String(record._id)),
  );
  const urlsByRecord = new Map<string, string[]>();
  // Attachments come back newest first; show pictures in the order they were taken.
  for (const attachment of [...attachments].reverse()) {
    const recordId = String(attachment.subjectId);
    urlsByRecord.set(recordId, [...(urlsByRecord.get(recordId) ?? []), serializeAttachment(attachment).url]);
  }

  const photosByOrder = new Map<string, string[]>();
  for (const record of records) {
    // Records are newest first: keep the first (latest) one that actually has pictures.
    const urls = urlsByRecord.get(String(record._id));
    if (urls && !photosByOrder.has(record.orderNumber)) photosByOrder.set(record.orderNumber, urls);
  }
  return photosByOrder;
}

/**
 * Status Check: orders in the chosen statuses that were LAST UPDATED within
 * the last `days` days (all of them when `days` is 0), most recently updated
 * first -- the point is to see what is going on right now. This is
 * deliberately different from Precheck/Packing, whose windows are on
 * creation date (see ShopfaClient.listOrdersByStatuses). Each order also
 * carries the final pictures taken in Packing when it was sent, if any.
 */
export async function listOrdersByStatus(
  statusCodes: number[],
  days: OrdersByStatusRangeDays,
): Promise<OrdersByStatusResultDTO> {
  const to = new Date();
  const window = days === 0 ? null : { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };

  const client = await getShopfaClient();
  const [orders, totals] = await Promise.all([
    client.listOrdersByStatuses(statusCodes, window),
    Promise.all(statusCodes.map((code) => client.countOrdersInStatus(code))),
  ]);
  orders.sort((a, b) => (b.updatedAt?.getTime() ?? -Infinity) - (a.updatedAt?.getTime() ?? -Infinity));

  const photosByOrder = await loadPackingPhotos(orders.map((order) => order.orderNumber));

  return {
    statusCodes,
    days,
    rangeFromISO: window ? window.from.toISOString() : null,
    rangeToISO: window ? window.to.toISOString() : null,
    orders: orders.map((order) => ({
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
      packingPhotoUrls: photosByOrder.get(order.orderNumber) ?? [],
    })),
    countsByStatus: statusCodes.map((statusCode, index) => ({
      statusCode,
      statusTitle: statusTitleForCode(statusCode),
      count: orders.filter((order) => order.statusCode === statusCode).length,
      totalInStatus: totals[index] ?? null,
    })),
    generatedAtISO: new Date().toISOString(),
  };
}
