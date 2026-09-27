import {
  ORDER_WORKFLOW_NOT_READY_STATUS_CODES,
  OrderStatusChangeSource,
  OrderWorkflowStatus,
} from "@complaint-system/shared";
import type {
  OrderPrecheckWarning,
  OrderPrecheckItemDTO,
  OrderPrecheckOrderDTO,
  OrderPrecheckRelatedOrderDTO,
  SaveOrderPrecheckItemInput,
  SaveOrderPrecheckResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { buildOrderPrecheckNote, parseOrderPrecheckUnavailableCodes } from "../integrations/shopfa/orderPrecheckNoteMarker";
import { ApiError } from "../utils/ApiError";
import { findCustomerSiblingOrders, recordStatusChange, statusTitleForCode, type WorkflowActor } from "./orderWorkflowService";
import { logger } from "../config/logger";

/** Oldest payment first -- orders paid earliest have to be checked/packed and delivered first. Falls back to the creation date for an order with no payment date, and sorts fully undated orders last. */
function byOldestFirst<T extends { paymentDate: Date | null; orderDate: Date | null }>(a: T, b: T): number {
  const time = (order: T) => (order.paymentDate ?? order.orderDate)?.getTime() ?? Infinity;
  return time(a) - time(b);
}

/**
 * Every order in the given Shopfa status codes, ready for Order Precheck's
 * one-at-a-time review -- each item's `available` is restored from a prior
 * precheck marker on the order's admin note when one exists (see
 * orderPrecheckNoteMarker.ts), or null when there's nothing to restore.
 */
export async function listOrdersForPrecheck(statusCodes: number[]): Promise<OrderPrecheckOrderDTO[]> {
  const client = await getShopfaClient();
  const orders = (await client.listOrdersByStatusForPrecheck(statusCodes)).sort(byOldestFirst);

  return orders.map((order) => {
    const unavailableCodes = parseOrderPrecheckUnavailableCodes(order.note);
    const items: OrderPrecheckItemDTO[] = order.items.map((item) => ({
      productCode: item.productCode,
      title: item.title,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      available: unavailableCodes === null ? null : !unavailableCodes.includes(item.productCode),
    }));
    return {
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      orderDateISO: order.orderDate ? order.orderDate.toISOString() : null,
      statusCode: order.statusCode,
      statusTitle: order.statusTitle,
      restoredFromPreviousPrecheck: unavailableCodes !== null,
      items,
    };
  });
}

interface RelatedChange {
  orderNumber: string;
  fromStatusCode: number;
  fromStatusTitle: string;
  toStatusCode: number;
}

/**
 * Applies one order's precheck decision following the order status machine
 * (docs/order-status-mchine.md), taking the customer's sibling orders into
 * account -- every other order of the same customer except shipped/cancelled
 * ones (see orderWorkflowService.findCustomerSiblingOrders):
 *
 * - Every item available:
 *   - no siblings -> "ارسال شده به سرویس پستی";
 *   - every sibling is in "تایید حسابداری" -> this order AND those siblings
 *     go to "ارسال شده به سرویس پستی", the whole set ships together;
 *   - some sibling is still in "پرداخت تائيد شده" / "پردازش انبار" /
 *     "اعلام پرداخت" -> this order is parked in "تایید حسابداری";
 *   - any other combination (e.g. a sibling already in "ارسال شده به سرویس
 *     پستی" or "آماده به ارسال") -> "آماده به ارسال", with a warning to check
 *     the Shopfa panel.
 * - Some item unavailable: this order goes to "پردازش انبار" (with the
 *   unavailable product codes written into its admin note, see
 *   orderPrecheckNoteMarker.ts). Siblings already in "ارسال شده به سرویس
 *   پستی" would ship without the missing items, so they're pulled back to
 *   "تایید حسابداری" -- but only after the user confirmed
 *   (`confirmStatusChanges`); without it nothing is changed and the result
 *   comes back with `saved: false` and the affected orders.
 *
 * The note write preserves whatever free text staff had already put there
 * outside of a prior precheck marker. Siblings are updated one by one after
 * the checked order itself; a failure on one is reported in
 * `relatedFailures` rather than undoing the rest. Every applied change is
 * recorded in the local status-change log.
 */
export async function saveOrderPrecheck(
  orderNumber: string,
  items: SaveOrderPrecheckItemInput[],
  confirmStatusChanges = false,
  actor?: WorkflowActor,
): Promise<SaveOrderPrecheckResultDTO> {
  const client = await getShopfaClient();
  const existing = await client.getOrderAdminNote(orderNumber);
  if (!existing) throw ApiError.notFound("Order not found");
  const details = await client.getOrderDetailsByNumber(orderNumber);
  if (!details) throw ApiError.notFound("Order not found");

  const unavailableProductCodes = items.filter((item) => !item.available).map((item) => item.productCode);
  const siblings = await findCustomerSiblingOrders(client, {
    orderNumber,
    buyerMobile: details.buyerMobile,
    buyerName: details.buyerName,
  });
  const moveSiblings = (from: number, to: number): RelatedChange[] =>
    siblings
      .filter((order) => order.statusCode === from)
      .map((order) => ({
        orderNumber: order.orderNumber,
        fromStatusCode: order.statusCode,
        fromStatusTitle: order.statusTitle,
        toStatusCode: to,
      }));

  let statusCode: number;
  let changes: RelatedChange[] = [];
  let warning: OrderPrecheckWarning | null = null;
  if (unavailableProductCodes.length === 0) {
    if (siblings.length === 0) {
      statusCode = OrderWorkflowStatus.SENT_TO_POST;
    } else if (siblings.every((order) => order.statusCode === OrderWorkflowStatus.ACCOUNTING_APPROVED)) {
      statusCode = OrderWorkflowStatus.SENT_TO_POST;
      changes = moveSiblings(OrderWorkflowStatus.ACCOUNTING_APPROVED, OrderWorkflowStatus.SENT_TO_POST);
    } else if (siblings.some((order) => ORDER_WORKFLOW_NOT_READY_STATUS_CODES.includes(order.statusCode))) {
      statusCode = OrderWorkflowStatus.ACCOUNTING_APPROVED;
    } else {
      statusCode = OrderWorkflowStatus.READY_TO_SEND;
      warning = "check_shopfa_panel";
    }
  } else {
    statusCode = OrderWorkflowStatus.WAREHOUSE_PROCESSING;
    changes = moveSiblings(OrderWorkflowStatus.SENT_TO_POST, OrderWorkflowStatus.ACCOUNTING_APPROVED);
  }

  const relatedOrders: OrderPrecheckRelatedOrderDTO[] = changes.map((change) => ({
    orderNumber: change.orderNumber,
    fromStatusTitle: change.fromStatusTitle,
    toStatusCode: change.toStatusCode,
    toStatusTitle: statusTitleForCode(change.toStatusCode),
  }));

  // Pulling already-postal-bound orders back is the one destructive-looking side effect: ask first.
  const needsConfirmation = unavailableProductCodes.length > 0 && changes.length > 0 && !confirmStatusChanges;
  if (needsConfirmation) {
    return {
      orderNumber,
      statusCode,
      statusTitle: statusTitleForCode(statusCode),
      unavailableProductCodes,
      saved: false,
      relatedOrders,
      relatedFailures: [],
      warning,
    };
  }

  const note = buildOrderPrecheckNote(existing.note, unavailableProductCodes);
  const result = await client.updateOrderNoteAndStatus(orderNumber, { note, statusCode });
  if (!result) throw ApiError.notFound("Order not found");
  await recordStatusChange({
    orderNumber: result.orderNumber,
    fromStatusCode: details.statusCode,
    toStatusCode: result.statusCode,
    toStatusTitle: result.statusTitle,
    source: OrderStatusChangeSource.PRECHECK,
    actor,
  });

  const relatedFailures: SaveOrderPrecheckResultDTO["relatedFailures"] = [];
  const applied: OrderPrecheckRelatedOrderDTO[] = [];
  for (const [index, change] of changes.entries()) {
    try {
      const updated = await client.updateOrderStatus(change.orderNumber, change.toStatusCode);
      if (!updated) throw ApiError.notFound("Order not found");
      applied.push(relatedOrders[index]!);
      await recordStatusChange({
        orderNumber: change.orderNumber,
        fromStatusCode: change.fromStatusCode,
        toStatusCode: updated.statusCode,
        toStatusTitle: updated.statusTitle,
        source: OrderStatusChangeSource.PRECHECK,
        actor,
      });
    } catch (err) {
      logger.error("Order Precheck: failed to update a related order's status", { orderNumber: change.orderNumber, err });
      relatedFailures.push({
        orderNumber: change.orderNumber,
        message: err instanceof ApiError ? err.message : "Unexpected error",
      });
    }
  }

  return {
    orderNumber: result.orderNumber,
    statusCode: result.statusCode,
    statusTitle: result.statusTitle || statusTitleForCode(statusCode),
    unavailableProductCodes,
    saved: true,
    relatedOrders: applied,
    relatedFailures,
    warning,
  };
}
