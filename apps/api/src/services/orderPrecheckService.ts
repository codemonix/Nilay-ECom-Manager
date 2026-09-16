import {
  ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE,
  ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";
import type {
  OrderPrecheckItemDTO,
  OrderPrecheckOrderDTO,
  SaveOrderPrecheckItemInput,
  SaveOrderPrecheckResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { buildOrderPrecheckNote, parseOrderPrecheckUnavailableCodes } from "../integrations/shopfa/orderPrecheckNoteMarker";
import { ApiError } from "../utils/ApiError";

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
  const orders = await client.listOrdersByStatusForPrecheck(statusCodes);

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

/**
 * Applies one order's precheck decision: every item available moves the
 * order straight to "ارسال شده به سرویس پستی", any unavailable item instead
 * moves it to "پردازش انبار" with those items' product codes written into
 * the admin note so a later reopen can restore the same decision (see
 * orderPrecheckNoteMarker.ts). The note write preserves whatever free text
 * staff had already put there outside of a prior precheck marker.
 */
export async function saveOrderPrecheck(
  orderNumber: string,
  items: SaveOrderPrecheckItemInput[],
): Promise<SaveOrderPrecheckResultDTO> {
  const client = await getShopfaClient();
  const existing = await client.getOrderAdminNote(orderNumber);
  if (!existing) throw ApiError.notFound("Order not found");

  const unavailableProductCodes = items.filter((item) => !item.available).map((item) => item.productCode);
  const statusCode =
    unavailableProductCodes.length > 0
      ? ORDER_PRECHECK_SOME_UNAVAILABLE_STATUS_CODE
      : ORDER_PRECHECK_ALL_AVAILABLE_STATUS_CODE;
  const note = buildOrderPrecheckNote(existing.note, unavailableProductCodes);

  const result = await client.updateOrderNoteAndStatus(orderNumber, { note, statusCode });
  if (!result) throw ApiError.notFound("Order not found");

  return {
    orderNumber: result.orderNumber,
    statusCode: result.statusCode,
    statusTitle: result.statusTitle || statusTitleForCode(statusCode),
    unavailableProductCodes,
  };
}
