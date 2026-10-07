import {
  CASE_RESOLVE_ORDER_STATUS_CODES,
  CaseEventType,
  CaseStatus,
  ORDER_FOLLOW_UP_STATUS_CODE,
  OrderStatusChangeSource,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";
import * as caseService from "./caseService";
import { recordStatusChange, statusTitleForCode, type WorkflowActor } from "./orderWorkflowService";

/**
 * Mirrors case activity onto the linked Shopfa order. Deliberately
 * best-effort: a Shopfa outage, or a non-live data source (imported/mock
 * clients reject order writes), must never fail or roll back the case
 * operation the staff member just performed -- failures are only logged.
 */
async function bestEffort(action: string, orderNumber: string, run: () => Promise<boolean>): Promise<boolean> {
  try {
    return await run();
  } catch (err) {
    logger.warn(`Case-to-order sync failed: ${action}`, { orderNumber, err });
    return false;
  }
}

/** `existing` with `line` added as a new last line; unchanged when the note already mentions this case. */
function appendNoteLine(existing: string, caseNumber: string, text: string): string {
  if (existing.includes(`[${caseNumber}]`)) return existing;
  const line = `[${caseNumber}] ${text.trim()}`;
  return existing.trim() ? `${existing.trimEnd()}\n${line}` : line;
}

/**
 * Puts the order into "در حال پیگیری" and writes the case number into its
 * admin note ("یادداشت مدیر"), so the order team sees in the Shopfa panel
 * that a case is open against it and which one. Returns whether Shopfa
 * applied it.
 */
export async function markOrderFollowedUp(
  orderNumber: string,
  caseInfo: { caseNumber: string; subject: string },
  actor: WorkflowActor | undefined,
): Promise<boolean> {
  return bestEffort("mark followed up", orderNumber, async () => {
    const client = await getShopfaClient();
    const existing = await client.getOrderAdminNote(orderNumber);
    if (!existing) return false;
    const note = appendNoteLine(existing.note, caseInfo.caseNumber, `پرونده ثبت شد: ${caseInfo.subject}`);
    const result = await client.updateOrderNoteAndStatus(orderNumber, { note, statusCode: ORDER_FOLLOW_UP_STATUS_CODE });
    if (!result || result.statusCode !== ORDER_FOLLOW_UP_STATUS_CODE) {
      logger.warn("Case-to-order sync: Shopfa did not apply the follow-up status", { orderNumber, result });
      return false;
    }
    await recordStatusChange({
      orderNumber,
      fromStatusCode: null,
      toStatusCode: result.statusCode,
      toStatusTitle: result.statusTitle,
      source: OrderStatusChangeSource.CASE,
      actor,
    });
    return true;
  });
}

/** Appends a case note as a new line in the order's admin note ("یادداشت مدیر"), keeping what is already there. */
export async function appendNoteToOrderAdminNote(
  orderNumber: string,
  caseNumber: string,
  noteBody: string,
): Promise<void> {
  await bestEffort("append admin note", orderNumber, async () => {
    const client = await getShopfaClient();
    const existing = await client.getOrderAdminNote(orderNumber);
    if (!existing) return false;
    const line = `[${caseNumber}] ${noteBody.trim()}`;
    const next = existing.note.trim() ? `${existing.note.trimEnd()}\n${line}` : line;
    await client.updateOrderAdminNote(orderNumber, next);
    return true;
  });
}

/**
 * Moves an order linked to a resolved (or closed) case on to the status the
 * staff member picked while resolving it. Unlike the mirroring above this is
 * an explicit request, so a Shopfa failure is reported to the caller.
 */
export async function changeOrderStatusFromCase(
  caseId: string,
  orderNumber: string,
  statusCode: number,
  actor: WorkflowActor | undefined,
) {
  if (!CASE_RESOLVE_ORDER_STATUS_CODES.includes(statusCode)) {
    throw ApiError.badRequest("This status cannot be set from a case");
  }
  const caseDoc = await caseService.getCaseById(caseId);
  if (caseDoc.status !== CaseStatus.RESOLVED && caseDoc.status !== CaseStatus.CLOSED) {
    throw ApiError.conflict("The order status can only be changed once the case is resolved");
  }
  if (!caseDoc.relatedOrders.some((order) => order.orderNumber === orderNumber)) {
    throw ApiError.notFound("This order is not linked to the case");
  }

  const client = await getShopfaClient();
  const updated = await client.updateOrderStatus(orderNumber, statusCode);
  if (!updated) throw ApiError.notFound("Order not found");
  if (updated.statusCode !== statusCode) {
    throw ApiError.badGateway(
      `Shopfa did not apply the status change: order is still "${updated.statusTitle}" (expected "${statusTitleForCode(statusCode)}")`,
    );
  }
  await recordStatusChange({
    orderNumber,
    fromStatusCode: ORDER_FOLLOW_UP_STATUS_CODE,
    toStatusCode: updated.statusCode,
    toStatusTitle: updated.statusTitle,
    source: OrderStatusChangeSource.CASE,
    actor,
  });
  return caseService.recordEvent(caseId, CaseEventType.ORDER_STATUS_CHANGED, actor, null, {
    orderNumber,
    statusCode: updated.statusCode,
    statusTitle: updated.statusTitle || statusTitleForCode(statusCode),
  });
}
