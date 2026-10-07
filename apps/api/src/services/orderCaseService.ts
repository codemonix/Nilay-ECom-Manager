import {
  CasePriority,
  CaseSource,
  CaseStatus,
  type OrderCaseContextDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { caseRepository } from "../repositories/caseRepository";
import { ApiError } from "../utils/ApiError";
import type { CreateOrderCaseInput } from "../validators/orderCaseValidators";
import * as caseService from "./caseService";
import * as caseOrderSyncService from "./caseOrderSyncService";

const FINISHED_CASE_STATUSES: string[] = [CaseStatus.RESOLVED, CaseStatus.CLOSED];

async function loadOrder(orderNumber: string) {
  const client = await getShopfaClient();
  const order = await client.getOrderDetailsByNumber(orderNumber);
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

/** The order's items (to pick the ones a new case is about) and the cases already open against it. */
export async function getOrderCaseContext(orderNumber: string): Promise<OrderCaseContextDTO> {
  const [order, cases] = await Promise.all([loadOrder(orderNumber), caseRepository.findByOrderNumbers([orderNumber])]);
  return {
    orderNumber: order.orderNumber,
    buyerName: order.buyerName,
    statusCode: order.statusCode,
    statusTitle: order.statusTitle,
    items: order.items.map(({ productCode, title, quantity }) => ({ productCode, title, quantity })),
    openCases: cases
      .filter((caseDoc) => !FINISHED_CASE_STATUSES.includes(caseDoc.status))
      .map((caseDoc) => ({
        id: String(caseDoc._id),
        caseNumber: caseDoc.caseNumber,
        subject: caseDoc.subject,
        status: caseDoc.status as CaseStatus,
      })),
  };
}

/**
 * Opens a case against an order from one of the order screens. The customer
 * and items are read from the order itself rather than trusted from the
 * request; the case is left unassigned so customer service picks it up. The
 * Shopfa side (status "در حال پیگیری" + case number in the admin note) is
 * best-effort -- see caseOrderSyncService -- and its outcome is returned as
 * `orderSynced`.
 */
export async function createOrderCase(
  orderNumber: string,
  input: CreateOrderCaseInput,
  actor: caseService.Actor | undefined,
) {
  const order = await loadOrder(orderNumber);

  const requested = new Set(input.productCodes ?? []);
  const relatedItems = order.items
    .filter((item) => requested.has(item.productCode))
    // Same item identity the Cases menu stores for an item without a variant (see mapApiOrderToSummary).
    .map((item) => ({ externalItemId: item.productCode, sku: item.productCode, title: item.title }));
  if (relatedItems.length !== requested.size) throw ApiError.badRequest("An item is not part of this order");

  const { case: caseDoc } = await caseService.createCase(
    {
      customer: {
        // The order carries no customer id here (most customers check out as guests); the phone number is what customer lookups fall back to.
        externalCustomerId: order.externalOrderId,
        name: order.buyerName || orderNumber,
        phone: order.buyerMobile ?? undefined,
      },
      subject: input.subject,
      description: input.description?.trim() || input.subject,
      category: input.category,
      priority: CasePriority.NORMAL,
      source: CaseSource.INTERNAL,
      relatedOrder: { externalOrderId: order.externalOrderId, orderNumber: order.orderNumber },
      relatedItems,
    },
    actor,
  );

  const orderSynced = await caseOrderSyncService.markOrderFollowedUp(order.orderNumber, caseDoc, actor);
  return { case: caseDoc, orderSynced };
}
