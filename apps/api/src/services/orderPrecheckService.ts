import {
  ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE,
  ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE,
  ORDER_PRECHECK_CUSTOMER_PENDING_STATUS_CODES,
  ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";
import type {
  OrderPrecheckItemDTO,
  OrderPrecheckOrderDTO,
  OrderPrecheckRelatedOrderDTO,
  SaveOrderPrecheckItemInput,
  SaveOrderPrecheckResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { buildOrderPrecheckNote, parseOrderPrecheckUnavailableCodes } from "../integrations/shopfa/orderPrecheckNoteMarker";
import { ApiError } from "../utils/ApiError";
import { customerGroupKey, normalizeMobile, normalizeName } from "../utils/customerMatching";
import { logger } from "../config/logger";

/** Oldest payment first -- orders paid earliest have to be checked/packed and delivered first. Falls back to the creation date for an order with no payment date, and sorts fully undated orders last. */
function byOldestFirst<T extends { paymentDate: Date | null; orderDate: Date | null }>(a: T, b: T): number {
  const time = (order: T) => (order.paymentDate ?? order.orderDate)?.getTime() ?? Infinity;
  return time(a) - time(b);
}

function statusTitleForCode(code: number): string {
  return SHOPFA_ORDER_STATUS_OPTIONS.find((option) => option.code === code)?.statusTitle ?? String(code);
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
  fromStatusTitle: string;
  toStatusCode: number;
}

/**
 * Applies one order's precheck decision, taking the same customer's OTHER
 * orders (matched by mobile, else by name -- see utils/customerMatching)
 * into account:
 *
 * - Every item available:
 *   - if the customer has another order still in "پرداخت تائيد شده" /
 *     "پردازش انبار" / "اعلام پرداخت" (not prechecked / short on stock yet),
 *     this order is parked in "تایید حسابداری" -- it ships together with the
 *     rest, not alone;
 *   - otherwise it goes to "ارسال شده به سرویس پستی", and the customer's
 *     other orders waiting in "تایید حسابداری" are promoted to it too, since
 *     the whole set is now ready.
 * - Some item unavailable: this order goes to "پردازش انبار" (with the
 *   unavailable product codes written into its admin note, see
 *   orderPrecheckNoteMarker.ts). If the customer has orders already in
 *   "ارسال شده به سرویس پستی", those would ship without the missing items,
 *   so they're pulled back to "تایید حسابداری" -- but only after the user
 *   confirmed (`confirmStatusChanges`); without it nothing is changed and
 *   the result comes back with `saved: false` and the affected orders.
 *
 * The note write preserves whatever free text staff had already put there
 * outside of a prior precheck marker. Other orders' statuses are updated
 * one by one after the checked order itself; a failure on one is reported
 * in `relatedFailures` rather than undoing the rest.
 */
export async function saveOrderPrecheck(
  orderNumber: string,
  items: SaveOrderPrecheckItemInput[],
  confirmStatusChanges = false,
): Promise<SaveOrderPrecheckResultDTO> {
  const client = await getShopfaClient();
  const existing = await client.getOrderAdminNote(orderNumber);
  if (!existing) throw ApiError.notFound("Order not found");
  const details = await client.getOrderDetailsByNumber(orderNumber);
  if (!details) throw ApiError.notFound("Order not found");

  const unavailableProductCodes = items.filter((item) => !item.available).map((item) => item.productCode);

  // Same customer's other orders. The Shopfa search is a substring match on name/family/mobile, so results are
  // narrowed to the exact customer with the same rule Packing uses to group them.
  const searchQuery =
    normalizeMobile(details.buyerMobile) !== null
      ? (details.buyerMobile as string)
      : (normalizeName(details.buyerName).split(" ").sort((a, b) => b.length - a.length)[0] ?? "");
  const myKey = customerGroupKey({ buyerMobile: details.buyerMobile, buyerName: details.buyerName, orderNumber });
  const others = searchQuery
    ? (await client.findOrdersByCustomerQuery(searchQuery)).filter(
        (order) => order.orderNumber !== orderNumber && customerGroupKey(order) === myKey,
      )
    : [];

  let statusCode: number;
  let changes: RelatedChange[] = [];
  if (unavailableProductCodes.length === 0) {
    if (others.some((order) => ORDER_PRECHECK_CUSTOMER_PENDING_STATUS_CODES.includes(order.statusCode))) {
      statusCode = ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE;
    } else {
      statusCode = ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE;
      changes = others
        .filter((order) => order.statusCode === ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE)
        .map((order) => ({
          orderNumber: order.orderNumber,
          fromStatusTitle: order.statusTitle,
          toStatusCode: ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE,
        }));
    }
  } else {
    statusCode = ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE;
    changes = others
      .filter((order) => order.statusCode === ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE)
      .map((order) => ({
        orderNumber: order.orderNumber,
        fromStatusTitle: order.statusTitle,
        toStatusCode: ORDER_PRECHECK_ACCOUNTING_CONFIRMED_STATUS_CODE,
      }));
  }

  const relatedOrders: OrderPrecheckRelatedOrderDTO[] = changes.map((change) => ({
    ...change,
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
    };
  }

  const note = buildOrderPrecheckNote(existing.note, unavailableProductCodes);
  const result = await client.updateOrderNoteAndStatus(orderNumber, { note, statusCode });
  if (!result) throw ApiError.notFound("Order not found");

  const relatedFailures: SaveOrderPrecheckResultDTO["relatedFailures"] = [];
  const applied: OrderPrecheckRelatedOrderDTO[] = [];
  for (const [index, change] of changes.entries()) {
    try {
      const updated = await client.updateOrderStatus(change.orderNumber, change.toStatusCode);
      if (!updated) throw ApiError.notFound("Order not found");
      applied.push(relatedOrders[index]!);
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
  };
}
