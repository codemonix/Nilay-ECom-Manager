import {
  CATEGORY_TREND_COLOR_SLOTS,
  CATEGORY_TREND_WINDOWS,
  SOLD_ORDER_STATUS_TITLES,
  type CategoryTrendBucketDTO,
  type CategoryTrendMonths,
  type CategoryTrendResultDTO,
  type CategoryTrendSeriesDTO,
  type CustomerReportCustomerDTO,
  type CustomerReportOrderDTO,
  type CustomerReportResultDTO,
  type ItemSalesCategoryDTO,
  type ItemSalesProductSearchResultDTO,
  type ItemSalesResultDTO,
  type ItemSalesRowDTO,
} from "@complaint-system/shared";
import type {
  ReportingOrderDetailsDTO,
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
import { ApiError } from "../utils/ApiError";
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

/** Looks up one live Shopfa order by its order number for the order details page -- see ShopfaClient.getOrderDetailsByNumber. */
export async function getOrderDetails(orderNumber: string): Promise<ReportingOrderDetailsDTO> {
  const client = await getShopfaClient();
  const order = await client.getOrderDetailsByNumber(orderNumber);
  if (!order) throw ApiError.notFound(`Order ${orderNumber} was not found`);
  return {
    externalOrderId: order.externalOrderId,
    orderNumber: order.orderNumber,
    buyerName: order.buyerName,
    orderDateISO: order.orderDate?.toISOString() ?? null,
    paymentDateISO: order.paymentDate?.toISOString() ?? null,
    statusCode: order.statusCode,
    statusTitle: order.statusTitle,
    note: order.note,
    items: order.items.map((item) => ({
      productId: item.productCode,
      title: item.title,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
    })),
  };
}

/**
 * Shopfa's business day is Iran time, which has been a fixed UTC+03:30
 * since DST was abolished in 2022. Report dates arrive as plain YYYY-MM-DD
 * values from date inputs; anchoring them to that offset makes "to
 * 2026-09-20" include the whole of that day in store time.
 */
function resolveDateWindow(from: string, to: string): { from: Date; to: Date } {
  return { from: new Date(`${from}T00:00:00+03:30`), to: new Date(`${to}T23:59:59+03:30`) };
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic digits to ASCII and folds +98/0098/98 prefixes on a mobile number into the local 09... form, so a pasted "+98 912 ..." finds the same orders as "0912 ...". Non-numeric (name) queries pass through trimmed. */
export function normalizeCustomerQuery(raw: string): string {
  let q = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  const compact = q.replace(/[\s\-()]/g, "");
  if (/^\+?\d+$/.test(compact)) {
    q = compact.replace(/^(\+98|0098|98)(?=9\d{9}$)/, "0");
    if (/^9\d{9}$/.test(q)) q = `0${q}`;
  }
  return q;
}

/**
 * Customer report -- every order for customers matching a name or mobile
 * number within the period, grouped per customer. See
 * CustomerReportCustomerDTO for how customers are told apart and what
 * counts toward the totals.
 */
export async function buildCustomerReport(query: string, fromDate: string, toDate: string): Promise<CustomerReportResultDTO> {
  const range = resolveDateWindow(fromDate, toDate);
  const normalizedQuery = normalizeCustomerQuery(query);
  const client = await getShopfaClient();
  const { orders, truncated } = await client.listOrdersForCustomerReport(normalizedQuery, range);

  const customers = new Map<string, CustomerReportCustomerDTO>();
  for (const order of orders) {
    const key = order.mobile ? `m:${order.mobile}` : `n:${order.buyerName}`;
    let customer = customers.get(key);
    if (!customer) {
      customer = {
        name: order.buyerName,
        mobile: order.mobile,
        orderCount: 0,
        soldOrderCount: 0,
        totalSpent: 0,
        soldItemCount: 0,
        orders: [],
      };
      customers.set(key, customer);
    }
    const counted = SOLD_ORDER_STATUS_TITLES.includes(order.statusTitle);
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    customer.orderCount += 1;
    if (counted) {
      customer.soldOrderCount += 1;
      customer.totalSpent += order.totalAmount;
      customer.soldItemCount += itemCount;
    }
    customer.orders.push({
      orderNumber: order.orderNumber,
      statusTitle: order.statusTitle,
      counted,
      orderDateISO: order.orderDate?.toISOString() ?? null,
      paymentDateISO: order.paymentDate?.toISOString() ?? null,
      totalAmount: order.totalAmount,
      itemCount,
      items: order.items,
    });
  }

  const effectiveTime = (o: CustomerReportOrderDTO) => Date.parse(o.paymentDateISO ?? o.orderDateISO ?? "") || 0;
  const result = Array.from(customers.values());
  for (const customer of result) customer.orders.sort((a, b) => effectiveTime(b) - effectiveTime(a));
  result.sort((a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount);

  return {
    query: normalizedQuery,
    rangeFromISO: range.from.toISOString(),
    rangeToISO: range.to.toISOString(),
    customers: result,
    truncated,
    generatedAtISO: new Date().toISOString(),
  };
}

/** Product categories for the item-sales report's picker. */
export async function listCategories(): Promise<ItemSalesCategoryDTO[]> {
  const client = await getShopfaClient();
  return client.listShopCategories();
}

/** Free-text product search for the item-sales report's product picker. */
export async function searchProducts(query: string): Promise<ItemSalesProductSearchResultDTO[]> {
  const client = await getShopfaClient();
  const products = await client.searchProducts(query);
  return products.map((p) => ({ productId: p.productCode, title: p.title, imageUrl: p.imageUrl ?? null }));
}

/** The category plus every category beneath it, following parent links -- a "necklace" category should include its sub-categories' products. */
function collectCategoryTree(categories: ItemSalesCategoryDTO[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) {
    for (const category of categories) {
      if (category.parentId === ids[i] && !ids.includes(category.id)) ids.push(category.id);
    }
  }
  return ids;
}

/**
 * Item sales report -- units and revenue of one product, or of every
 * product in a category (and its sub-categories), in the period. See
 * ItemSalesResultDTO for the counting rules.
 */
export async function buildItemSalesReport(
  scope: { productId?: string; categoryId?: string },
  fromDate: string,
  toDate: string,
): Promise<ItemSalesResultDTO> {
  const range = resolveDateWindow(fromDate, toDate);
  const client = await getShopfaClient();
  const soldItems = await client.listSoldItemsForReport(range);

  let label: string;
  let categoryCount = 0;
  let rows: ItemSalesRowDTO[];

  if (scope.productId) {
    const productId = scope.productId;
    const product = await client.getProductByCode(productId);
    const sold = soldItems.find((entry) => entry.productId === productId);
    label = product?.title ?? sold?.title ?? productId;
    rows = sold
      ? [{ ...sold, imageUrl: sold.imageUrl ?? product?.imageUrl ?? null }]
      : [{ productId, title: label, imageUrl: product?.imageUrl ?? null, quantity: 0, revenue: 0, orderCount: 0 }];
  } else {
    const categoryId = scope.categoryId as string;
    const categories = await client.listShopCategories();
    const category = categories.find((c) => c.id === categoryId);
    if (!category) throw ApiError.notFound(`Category ${categoryId} was not found`);
    const treeIds = collectCategoryTree(categories, categoryId);
    categoryCount = treeIds.length - 1;
    const productIds = new Set<string>();
    for (const id of treeIds) {
      for (const productId of await client.listProductIdsInCategory(id)) productIds.add(productId);
    }
    label = category.title;
    rows = soldItems.filter((entry) => productIds.has(entry.productId)).sort((a, b) => b.quantity - a.quantity);
  }

  return {
    scope: scope.productId ? "product" : "category",
    label,
    categoryCount,
    rangeFromISO: range.from.toISOString(),
    rangeToISO: range.to.toISOString(),
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    orderCount: scope.productId ? (rows[0]?.orderCount ?? 0) : null,
    productsSold: rows.filter((row) => row.quantity > 0).length,
    rows,
    generatedAtISO: new Date().toISOString(),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OTHER_SERIES_ID = "other";

function addAt(values: number[], index: number, delta: number): void {
  values[index] = (values[index] ?? 0) + delta;
}

function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Maps every category id to the id of the chart series it rolls up into: a
 * top-level category (parent "0") with sub-categories is split into those
 * sub-categories (deeper levels roll up into them); a top-level category
 * without children is a series itself. Products assigned directly to a
 * top-level category that has sub-categories stay on that category.
 */
export function mapCategoriesToSeries(categories: ItemSalesCategoryDTO[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hasChildren = new Set(categories.map((c) => c.parentId));
  const result = new Map<string, string>();
  for (const category of categories) {
    let node = category;
    const seen = new Set<string>();
    while (node.parentId !== "0" && byId.has(node.parentId) && !seen.has(node.id)) {
      seen.add(node.id);
      const parent = byId.get(node.parentId) as ItemSalesCategoryDTO;
      // Stop at the child directly beneath a split top-level category.
      if (parent.parentId === "0" && hasChildren.has(parent.id)) break;
      node = parent;
    }
    result.set(category.id, node.id);
  }
  return result;
}

/**
 * Assigns each chart series (see mapCategoriesToSeries) a fixed palette slot from the store's own category order,
 * so a category's color never depends on the time window, the measure, or what happened to sell. The first
 * CATEGORY_TREND_COLOR_SLOTS series in menu order get slots 0..n-1; the rest (and any split top-level category,
 * which only holds products listed directly on it) have no slot and are folded into "other". Series ids are
 * ordered by their category's `order`, ties broken by id.
 */
export function assignSeriesColorSlots(categories: ItemSalesCategoryDTO[]): Map<string, number> {
  const seriesOfCategory = mapCategoriesToSeries(categories);
  const hasChildren = new Set(categories.map((c) => c.parentId));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const candidates = Array.from(new Set(seriesOfCategory.values()))
    .map((id) => byId.get(id))
    .filter((c): c is ItemSalesCategoryDTO => c !== undefined)
    // A split top-level category (has sub-categories) is only the parent of real series, not a series itself.
    .filter((c) => !(c.parentId === "0" && hasChildren.has(c.id)))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return new Map(candidates.slice(0, CATEGORY_TREND_COLOR_SLOTS).map((c, slot) => [c.id, slot]));
}

/**
 * Category sales over time: units and revenue per category per fixed-size
 * time bucket ending today (see CATEGORY_TREND_WINDOWS). Series and their
 * colors are fixed by the store's category order (assignSeriesColorSlots);
 * everything else folds into one "other" series.
 */
export async function buildCategoryTrends(months: CategoryTrendMonths, stepDays?: number): Promise<CategoryTrendResultDTO> {
  const window = CATEGORY_TREND_WINDOWS.find((w) => w.months === months);
  if (!window) throw ApiError.badRequest("Unsupported window");
  const step = stepDays ?? window.stepDays;
  if (!(window.stepOptions as readonly number[]).includes(step)) throw ApiError.badRequest("Unsupported step");
  const bucketCount = window.days / step;

  const today = new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const buckets: CategoryTrendBucketDTO[] = [];
  for (let k = 0; k < bucketCount; k += 1) {
    const endDate = addDays(today, -(bucketCount - 1 - k) * step);
    buckets.push({ startDate: addDays(endDate, -(step - 1)), endDate });
  }
  const range = resolveDateWindow((buckets[0] as CategoryTrendBucketDTO).startDate, today);

  const client = await getShopfaClient();
  const [rows, categories] = await Promise.all([client.listSoldItemsByDay(range), client.listShopCategories()]);

  const seriesOfCategory = mapCategoriesToSeries(categories);
  const colorSlots = assignSeriesColorSlots(categories);
  const seriesTitle = new Map(categories.map((c) => [c.id, c.title]));
  // Confirmed live: `product/list?page_id=` is hierarchical -- a parent's list also contains every descendant's products -- so
  // walk categories deepest-first and let each product keep the first (most specific) series it is seen in.
  const depthOf = (category: ItemSalesCategoryDTO): number => {
    let depth = 0;
    let parentId = category.parentId;
    while (parentId !== "0" && depth < 10) {
      const parent = categories.find((c) => c.id === parentId);
      if (!parent) break;
      depth += 1;
      parentId = parent.parentId;
    }
    return depth;
  };
  const seriesOfProduct = new Map<string, string>();
  for (const category of [...categories].sort((a, b) => depthOf(b) - depthOf(a))) {
    const seriesId = seriesOfCategory.get(category.id) as string;
    for (const productId of await client.listProductIdsInCategory(category.id)) {
      if (!seriesOfProduct.has(productId)) seriesOfProduct.set(productId, seriesId);
    }
  }

  const empty = (categoryId: string, title: string): CategoryTrendSeriesDTO => ({
    categoryId,
    title,
    colorSlot: colorSlots.get(categoryId) ?? null,
    totalQuantity: 0,
    totalRevenue: 0,
    quantity: new Array<number>(bucketCount).fill(0),
    revenue: new Array<number>(bucketCount).fill(0),
  });
  const series = new Map<string, CategoryTrendSeriesDTO>();
  for (const row of rows) {
    const bucketIndex = buckets.findIndex((b) => row.day >= b.startDate && row.day <= b.endDate);
    if (bucketIndex === -1) continue;
    const mappedSeriesId = seriesOfProduct.get(row.productId);
    const seriesId = mappedSeriesId !== undefined && colorSlots.has(mappedSeriesId) ? mappedSeriesId : OTHER_SERIES_ID;
    let entry = series.get(seriesId);
    if (!entry) {
      entry = empty(seriesId, seriesTitle.get(seriesId) ?? "");
      series.set(seriesId, entry);
    }
    addAt(entry.quantity, bucketIndex, row.quantity);
    addAt(entry.revenue, bucketIndex, row.revenue);
    entry.totalQuantity += row.quantity;
    entry.totalRevenue += row.revenue;
  }

  // Stable, store-defined order (slot order) -- never re-sorted by sales -- with "other" (if any sales) last.
  const kept = Array.from(series.values())
    .filter((s) => s.categoryId !== OTHER_SERIES_ID)
    .sort((a, b) => (a.colorSlot ?? 0) - (b.colorSlot ?? 0));
  const other = series.get(OTHER_SERIES_ID);
  if (other && other.totalQuantity > 0) kept.push(other);

  return {
    months,
    stepDays: step,
    rangeFromISO: range.from.toISOString(),
    rangeToISO: range.to.toISOString(),
    buckets,
    series: kept,
    generatedAtISO: new Date().toISOString(),
  };
}
