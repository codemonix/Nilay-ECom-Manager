import { getShopfaClient } from "../integrations/shopfa";
import { logger } from "../config/logger";

/** Shopfa order status "در حال پیگیری" (being followed up) -- see SHOPFA_ORDER_STATUS_OPTIONS. */
export const ORDER_FOLLOW_UP_STATUS_CODE = 16;

/**
 * Mirrors case activity onto the linked Shopfa order. Deliberately
 * best-effort: a Shopfa outage, or a non-live data source (imported/mock
 * clients reject order writes), must never fail or roll back the case
 * operation the staff member just performed -- failures are only logged.
 */
async function bestEffort(action: string, orderNumber: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    logger.warn(`Case-to-order sync failed: ${action}`, { orderNumber, err });
  }
}

/** Puts the order into "در حال پیگیری" so the order team knows a case is open against it. */
export async function markOrderFollowedUp(orderNumber: string): Promise<void> {
  await bestEffort("set status", orderNumber, async () => {
    const client = await getShopfaClient();
    await client.updateOrderStatus(orderNumber, ORDER_FOLLOW_UP_STATUS_CODE);
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
    if (!existing) return;
    const line = `[${caseNumber}] ${noteBody.trim()}`;
    const next = existing.note.trim() ? `${existing.note.trimEnd()}\n${line}` : line;
    await client.updateOrderAdminNote(orderNumber, next);
  });
}
