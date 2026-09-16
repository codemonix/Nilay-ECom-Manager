import {
  PACKING_SENT_STATUS_CODE,
  PACKING_SOURCE_STATUS_CODE,
  SHOPFA_ORDER_STATUS_OPTIONS,
} from "@complaint-system/shared";
import type { PackingListResultDTO, PackingRangeDays, SendPackedOrderResultDTO } from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { ApiError } from "../utils/ApiError";

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

/** Moves an order to "ارسال شده" once every item has been physically packed and confirmed -- no admin note involved, unlike Order Precheck. */
export async function markOrderPacked(orderNumber: string): Promise<SendPackedOrderResultDTO> {
  const client = await getShopfaClient();
  const result = await client.updateOrderStatus(orderNumber, PACKING_SENT_STATUS_CODE);
  if (!result) throw ApiError.notFound("Order not found");
  return {
    orderNumber: result.orderNumber,
    statusCode: result.statusCode,
    statusTitle: result.statusTitle || statusTitleForCode(PACKING_SENT_STATUS_CODE),
  };
}
