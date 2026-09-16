import type {
  OrderAdminNoteDTO,
  SoldItemSearchResultDTO,
  SoldQuantityRangeDays,
  SoldQuantityResultDTO,
  TitleAsteriskCheckResultDTO,
  ToggleTitleAsteriskResultDTO,
  UpdateOrderAdminNoteResultDTO,
} from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { shopfaTitleEndsWithAsterisk } from "../integrations/shopfa/shopfaTitle";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/**
 * Base host for deep-linking into the Shopfa admin dashboard's product
 * editor (see checkTitleAsterisk), and as a manual fallback if
 * toggleTitleAsterisk's write ever fails. Not the same host that serves
 * the API: SHOPFA_API_BASE_URL can carry a "www." prefix the admin site
 * itself doesn't use (and which used to 301-redirect API writes into
 * silently losing their body -- see the shopfa-api-testing-fixtures
 * memory for why that mattered here too).
 */
const SHOPFA_ADMIN_BASE_URL = env.SHOPFA_API_BASE_URL.replace(/^https?:\/\/www\./, "https://");

/**
 * Order statuses that count as an actual completed sale for the "total sold
 * quantity" check (business rule confirmed with the product owner). Every
 * other status an order can carry -- cancelled, an abandoned checkout form,
 * or one still being followed up -- is excluded from the total but still
 * shown in the per-status breakdown.
 *
 * "پرداخت تائيد شده" is spelled with the Arabic yeh/hamza combination
 * exactly as Shopfa stores it (both in the xlsx export and the live API's
 * `status_title`); a plain-Persian-yeh spelling ("پرداخت تایید شده") would
 * silently fail to match any order.
 */
const SOLD_STATUSES = [
  "ارسال شده",
  "پردازش انبار",
  "تایید حسابداری",
  "ارسال شده به سرویس پستی",
  "پرداخت تائيد شده",
  "اعلام پرداخت",
];

/** Free-text search by name, delegated to the active Shopfa client (live API or imported-order data, per Settings.dataSource) -- for Development Tools' "search by name and pick" flow. */
export async function searchItems(query: string): Promise<SoldItemSearchResultDTO[]> {
  const client = await getShopfaClient();
  const results = await client.searchProducts(query);
  return results.map((r) => ({ productCode: r.productCode, sku: r.sku, title: r.title }));
}

/**
 * Total quantity sold for a product code within the last `days` days,
 * summed only across orders whose status is in SOLD_STATUSES. `days` is
 * resolved to a window against each order's *payment* date, not when it
 * was placed (HttpShopfaClient.scanOrdersForSoldQuantity) -- a "sold in
 * the last N days" figure should reflect when payment actually happened,
 * and for this store the two can differ by weeks for orders confirmed via
 * manual bank transfer. Sourced from the active Shopfa client (live API or
 * imported-order data), so accuracy depends on Settings.dataSource -- see
 * getSoldQuantityBreakdown on each client implementation. Zero quantity for
 * a valid but never-sold code is a legitimate result, not an error.
 */
export async function getSoldQuantity(productCode: string, days: SoldQuantityRangeDays): Promise<SoldQuantityResultDTO> {
  const code = productCode.trim();
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const client = await getShopfaClient();
  const [product, soldQuantity] = await Promise.all([
    client.getProductByCode(code),
    client.getSoldQuantityBreakdown(code, { days, from, to }),
  ]);

  const breakdown = soldQuantity.rows.map((row) => ({ ...row, countedInTotal: SOLD_STATUSES.includes(row.status) }));
  const counted = breakdown.filter((row) => row.countedInTotal);

  return {
    productCode: code,
    title: product?.title ?? null,
    days,
    rangeFromISO: from.toISOString(),
    rangeToISO: to.toISOString(),
    totalQuantity: counted.reduce((sum, row) => sum + row.quantity, 0),
    orderCount: counted.reduce((sum, row) => sum + row.orderCount, 0),
    byStatus: breakdown,
    fetchedAtISO: soldQuantity.fetchedAt.toISOString(),
    fromCache: soldQuantity.servedFromCache,
  };
}

/** Looks up a product by code and reports whether its title currently ends in "*" -- Development Tools' "title asterisk" check. `adminEditUrl` links to the manual editor, since there's no reliable API-based way to change it (see SHOPFA_ADMIN_BASE_URL). */
export async function checkTitleAsterisk(productCode: string): Promise<TitleAsteriskCheckResultDTO> {
  const client = await getShopfaClient();
  const product = await client.getProductByCode(productCode.trim());
  if (!product) throw ApiError.notFound("Product not found");
  return {
    productCode: product.productCode,
    title: product.title,
    hasAsterisk: shopfaTitleEndsWithAsterisk(product.title),
    adminEditUrl: `${SHOPFA_ADMIN_BASE_URL}/manage/products/edit?product_id=${encodeURIComponent(product.productCode)}`,
  };
}

/**
 * Flips a product title's trailing "*" on or off. See
 * ShopfaClient.updateProductTitle for why the result is verified by
 * re-fetching rather than trusted from the update call's own response --
 * `applied` tells the caller whether the title on Shopfa actually changed.
 */
export async function toggleTitleAsterisk(productCode: string): Promise<ToggleTitleAsteriskResultDTO> {
  const client = await getShopfaClient();
  const product = await client.getProductByCode(productCode.trim());
  if (!product) throw ApiError.notFound("Product not found");

  const trimmedTitle = product.title.trim();
  const hadAsterisk = shopfaTitleEndsWithAsterisk(trimmedTitle);
  const requestedTitle = hadAsterisk ? trimmedTitle.slice(0, -1).trim() : `${trimmedTitle} *`;

  const updated = await client.updateProductTitle(product.productCode, requestedTitle);
  const currentTitle = updated?.title ?? product.title;

  return {
    productCode: product.productCode,
    previousTitle: product.title,
    requestedTitle,
    currentTitle,
    hasAsterisk: shopfaTitleEndsWithAsterisk(currentTitle),
    applied: currentTitle === requestedTitle,
  };
}

/**
 * Looks up an order by its customer-facing order number and returns its
 * admin note ("یادداشت مدیر" in the Shopfa dashboard) -- Development
 * Tools' order-note tool. See ShopfaClient.getOrderAdminNote for how this
 * is actually read from Shopfa.
 */
export async function getOrderAdminNote(orderNumber: string): Promise<OrderAdminNoteDTO> {
  const client = await getShopfaClient();
  const result = await client.getOrderAdminNote(orderNumber.trim());
  if (!result) throw ApiError.notFound("Order not found");
  return result;
}

/**
 * Sets an order's admin note. See ShopfaClient.updateOrderAdminNote for
 * why the result is verified by re-fetching rather than trusted from the
 * update call's own response.
 */
export async function updateOrderAdminNote(orderNumber: string, note: string): Promise<UpdateOrderAdminNoteResultDTO> {
  const client = await getShopfaClient();
  const trimmedOrderNumber = orderNumber.trim();
  const existing = await client.getOrderAdminNote(trimmedOrderNumber);
  if (!existing) throw ApiError.notFound("Order not found");

  const updated = await client.updateOrderAdminNote(trimmedOrderNumber, note);
  const currentNote = updated?.note ?? existing.note;

  return {
    externalOrderId: existing.externalOrderId,
    orderNumber: existing.orderNumber,
    previousNote: existing.note,
    requestedNote: note,
    currentNote,
    applied: currentNote === note,
  };
}
