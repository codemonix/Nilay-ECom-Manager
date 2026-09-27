import {
  AttachmentSubjectType,
  ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES,
  SHOPFA_ORDER_STATUS_OPTIONS,
  ShopfaSyncStatus,
} from "@complaint-system/shared";
import type { OrderHistoryDTO, OrderStatusChangeSource } from "@complaint-system/shared";
import type { ShopfaClient } from "../integrations/shopfa";
import type { ShopfaCustomerOrderRef } from "../integrations/shopfa/shopfaTypes";
import { orderStatusChangeRepository } from "../repositories/orderStatusChangeRepository";
import { packingRecordRepository } from "../repositories/packingRecordRepository";
import * as attachmentService from "./attachmentService";
import { serializeAttachment } from "../utils/serializers";
import { customerGroupKey, normalizeMobile, normalizeName } from "../utils/customerMatching";
import { logger } from "../config/logger";

export interface WorkflowActor {
  id: string;
  name: string;
}

export function statusTitleForCode(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
}

/**
 * The customer's other orders that take part in the status machine: every
 * order of the same customer (matched by mobile, else by name -- see
 * utils/customerMatching) except `orderNumber` itself and orders already
 * shipped or cancelled (ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES). The
 * Shopfa search is a substring match on name/family/mobile, so its results
 * are narrowed to the exact customer here.
 */
export async function findCustomerSiblingOrders(
  client: ShopfaClient,
  order: { orderNumber: string; buyerMobile: string | null; buyerName: string | null },
): Promise<ShopfaCustomerOrderRef[]> {
  const searchQuery =
    normalizeMobile(order.buyerMobile) !== null
      ? (order.buyerMobile as string)
      : (normalizeName(order.buyerName).split(" ").sort((a, b) => b.length - a.length)[0] ?? "");
  if (!searchQuery) return [];
  const myKey = customerGroupKey(order);
  return (await client.findOrdersByCustomerQuery(searchQuery)).filter(
    (other) =>
      other.orderNumber !== order.orderNumber &&
      customerGroupKey(other) === myKey &&
      !ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES.includes(other.statusCode),
  );
}

/**
 * Appends a status change to the local audit log. Called only after Shopfa
 * confirmed the change. A failure here is logged, never thrown: the Shopfa
 * change already happened and must not be reported as failed because of the
 * audit write.
 */
export async function recordStatusChange(entry: {
  orderNumber: string;
  fromStatusCode: number | null;
  toStatusCode: number;
  toStatusTitle?: string;
  source: OrderStatusChangeSource;
  actor: WorkflowActor | undefined | null;
}): Promise<void> {
  try {
    await orderStatusChangeRepository.create({
      orderNumber: entry.orderNumber,
      fromStatusCode: entry.fromStatusCode,
      toStatusCode: entry.toStatusCode,
      toStatusTitle: entry.toStatusTitle || statusTitleForCode(entry.toStatusCode),
      source: entry.source,
      changedBy: entry.actor?.id ?? null,
      changedByName: entry.actor?.name ?? null,
      changedAt: new Date(),
    });
  } catch (err) {
    logger.error("Order workflow: failed to record a status change", { orderNumber: entry.orderNumber, err });
  }
}

/** Every status change this system made to the order, plus each packing pass with its local pictures and Shopfa sync state. */
export async function getOrderHistory(orderNumber: string): Promise<OrderHistoryDTO> {
  const [changes, records] = await Promise.all([
    orderStatusChangeRepository.listByOrderNumber(orderNumber),
    packingRecordRepository.listByOrderNumber(orderNumber),
  ]);
  const attachments = await attachmentService.listAttachmentsBySubjectIds(
    AttachmentSubjectType.PACKING_RECORD,
    records.map((record) => String(record._id)),
  );
  // Attachments come back newest first; history shows photos in the order they were taken.
  const photoUrlsByRecordId = new Map<string, string[]>();
  for (const attachment of [...attachments].reverse()) {
    const recordId = String(attachment.subjectId);
    photoUrlsByRecordId.set(recordId, [...(photoUrlsByRecordId.get(recordId) ?? []), serializeAttachment(attachment).url]);
  }

  return {
    orderNumber,
    statusChanges: changes.map((change) => ({
      orderNumber: change.orderNumber,
      fromStatusCode: change.fromStatusCode ?? null,
      toStatusCode: change.toStatusCode,
      toStatusTitle: change.toStatusTitle,
      source: change.source as OrderStatusChangeSource,
      changedByName: change.changedByName ?? null,
      changedAtISO: change.changedAt.toISOString(),
    })),
    packings: records.map((record) => ({
      packingRecordId: String(record._id),
      sentAtISO: record.sentAt.toISOString(),
      sentByName: record.sentByName ?? null,
      photoUrls: photoUrlsByRecordId.get(String(record._id)) ?? [],
      syncStatus: (record.syncStatus as ShopfaSyncStatus | undefined) ?? ShopfaSyncStatus.SYNCED,
      syncAttempts: record.syncAttempts ?? 0,
      lastSyncError: record.lastSyncError ?? null,
    })),
  };
}
