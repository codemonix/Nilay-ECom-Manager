import type {
  ShortageReportItemDTO,
  ShortageReportRangeDays,
  ShortageReportResultDTO,
  UnresolvedShortageNoteDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import {
  noteReferencesItems,
  parseNoteItemRowNumbers,
  sortItemsForNoteRowNumbering,
} from "../integrations/shopfa/shopfaOrderNoteParser";
import { parseOrderPrecheckUnavailableCodes } from "../integrations/shopfa/orderPrecheckNoteMarker";
import type { ShopfaShortageReportOrderItem } from "../integrations/shopfa/shopfaTypes";

interface ShortageItemAccumulator {
  productId: string;
  variantId: string | null;
  title: string;
  imageUrl: string | null;
  orderNumbers: Set<string>;
  totalShortageQuantity: number;
  oldestPaymentDate: Date | null;
  newestPaymentDate: Date | null;
}

function itemKey(item: ShopfaShortageReportOrderItem): string {
  return `${item.productId}::${item.variantId ?? ""}`;
}

/**
 * Builds Reporting's shortage report: scans every order in the given
 * Shopfa status codes, decides which of its items are short based on its
 * admin note ("یادداشت مدیر"), and aggregates by product (+variant)
 * across every affected order.
 *
 * A note can carry either of two independent shortage signals, checked in
 * this order:
 *
 * 1. A system-generated Order Precheck marker (see
 *    orderPrecheckNoteMarker.ts) -- a precise list of product codes, so the
 *    affected items are resolved by matching `productId` directly instead
 *    of the row-number guess below. A marker whose codes don't match any
 *    item on the order (a stale marker, or a product/variant mismatch) is
 *    treated the same as an unparseable manual note: excluded from the
 *    item breakdown and listed in `unresolvedNotes` for manual review. A
 *    marker that resolves to an explicitly empty code list (only reachable
 *    via a hand-edited note -- Order Precheck itself never writes an empty
 *    marker, see buildOrderPrecheckNote) means precheck already confirmed
 *    every item available, so the order contributes nothing at all, not
 *    even a whole-order shortage.
 * 2. The older manual convention: a note mentioning "مورد"/"موارد" followed
 *    by row numbers (see shopfaOrderNoteParser.ts), resolved against the
 *    order's items sorted alphabetically the same way the Shopfa dashboard
 *    displays them. A note that mentions the keyword but resolves to no
 *    valid row (an out-of-range or unparseable reference, e.g. an "all
 *    except N" phrasing the parser doesn't understand) is likewise
 *    excluded and listed in `unresolvedNotes`.
 *
 * An order whose note carries neither signal counts its WHOLE item list as
 * short (per the business rule this was originally built for -- no note
 * detail means nothing was ruled out).
 *
 * `oldestPaymentDateISO`/`newestPaymentDateISO` are strictly the order's
 * `payment_date` -- an order that hasn't been paid yet doesn't move either
 * marker for the items it contributes (it still counts toward
 * `affectedOrderCount`/`totalShortageQuantity`).
 */
export async function buildShortageReport(
  statusCodes: number[],
  days: ShortageReportRangeDays,
): Promise<ShortageReportResultDTO> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const client = await getShopfaClient();
  const orders = await client.listOrdersByStatusForShortageReport(statusCodes, { from, to });

  const accumulators = new Map<string, ShortageItemAccumulator>();
  let wholeOrderShortageOrderCount = 0;
  const unresolvedNotes: UnresolvedShortageNoteDTO[] = [];

  for (const order of orders) {
    const note = order.note.trim();
    let shortageItems: ShopfaShortageReportOrderItem[];

    const precheckCodes = parseOrderPrecheckUnavailableCodes(note);
    if (precheckCodes !== null) {
      if (precheckCodes.length === 0) continue;
      shortageItems = order.items.filter((item) => precheckCodes.includes(item.productId));
      if (shortageItems.length === 0) {
        unresolvedNotes.push({ orderNumber: order.orderNumber, note });
        continue;
      }
    } else if (!noteReferencesItems(note)) {
      shortageItems = order.items;
      wholeOrderShortageOrderCount += 1;
    } else {
      const sortedItems = sortItemsForNoteRowNumbering(order.items);
      const rowNumbers = parseNoteItemRowNumbers(note);
      shortageItems = rowNumbers
        .map((rowNumber) => sortedItems[rowNumber - 1])
        .filter((item): item is ShopfaShortageReportOrderItem => item !== undefined);
      if (shortageItems.length === 0) {
        unresolvedNotes.push({ orderNumber: order.orderNumber, note });
        continue;
      }
    }

    for (const item of shortageItems) {
      const key = itemKey(item);
      let accumulator = accumulators.get(key);
      if (!accumulator) {
        accumulator = {
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          imageUrl: item.imageUrl,
          orderNumbers: new Set(),
          totalShortageQuantity: 0,
          oldestPaymentDate: null,
          newestPaymentDate: null,
        };
        accumulators.set(key, accumulator);
      }
      accumulator.orderNumbers.add(order.orderNumber);
      accumulator.totalShortageQuantity += item.quantity;
      if (order.paymentDate) {
        if (!accumulator.oldestPaymentDate || order.paymentDate < accumulator.oldestPaymentDate) {
          accumulator.oldestPaymentDate = order.paymentDate;
        }
        if (!accumulator.newestPaymentDate || order.paymentDate > accumulator.newestPaymentDate) {
          accumulator.newestPaymentDate = order.paymentDate;
        }
      }
    }
  }

  const items: ShortageReportItemDTO[] = Array.from(accumulators.values())
    .map(
      (accumulator): ShortageReportItemDTO => ({
        productId: accumulator.productId,
        variantId: accumulator.variantId,
        title: accumulator.title,
        imageUrl: accumulator.imageUrl,
        affectedOrderCount: accumulator.orderNumbers.size,
        totalShortageQuantity: accumulator.totalShortageQuantity,
        oldestPaymentDateISO: accumulator.oldestPaymentDate?.toISOString() ?? null,
        newestPaymentDateISO: accumulator.newestPaymentDate?.toISOString() ?? null,
        orderNumbers: Array.from(accumulator.orderNumbers),
      }),
    )
    .sort((a, b) => b.affectedOrderCount - a.affectedOrderCount);

  return {
    statusCodes,
    days,
    rangeFromISO: from.toISOString(),
    rangeToISO: to.toISOString(),
    totalOrdersScanned: orders.length,
    wholeOrderShortageOrderCount,
    unresolvedNotes,
    items,
    generatedAtISO: new Date().toISOString(),
  };
}
