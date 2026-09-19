import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
  SoldQuantityRangeDays,
} from "@complaint-system/shared";
import type {
  ShopfaClient,
  ShopfaDateRange,
  ShopfaOrderAdminNote,
  ShopfaOrderDateWindow,
  ShopfaOrderPrecheckUpdate,
  ShopfaOrderPrecheckUpdateResult,
  ShopfaOrderStatusUpdateResult,
  ShopfaPackingOrder,
  ShopfaPrecheckOrder,
  ShopfaProductLookup,
  ShopfaShortageReportOrder,
  ShopfaSoldQuantityResult,
  ShopfaSoldQuantityStatusRow,
} from "./shopfaTypes";
import type {
  ShopfaApiOrder,
  ShopfaApiOrderListResponse,
  ShopfaApiProductListResponse,
  ShopfaApiUserListResponse,
} from "./shopfaApiTypes";
import {
  extractOrderDetails,
  mapApiOrderToPackingOrder,
  mapApiOrderToPrecheckOrder,
  mapApiOrderToShortageReportOrder,
  mapApiOrderToSummary,
  mapApiProductToLookup,
  mapApiUserToSearchResult,
  readOrderBaskets,
  readProductItems,
  readUserItems,
  summarizeCustomerOrders,
} from "./shopfaApiMapper";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/ApiError";
import { record as recordShopfaTransaction } from "../../services/shopfaTransactionLogService";

/** Augments axios's request config with a start-time marker so the response/error interceptor can compute call duration for ShopfaTransactionLog. */
interface RequestConfigWithTiming extends InternalAxiosRequestConfig {
  shopfaLogStartedAt?: number;
}

/** Per-status quantity/order-count accumulator for one product code, keyed by status label -- see SoldQuantityIndexEntry. */
type SoldQuantityStatusMap = Map<string, { quantity: number; orderIds: Set<string | number> }>;

/** One cached order scan for a single time-frame bucket (see getSoldQuantityBreakdown's cache), indexed by every product code seen -- not just whichever one was originally asked for -- so a later check for a *different* product within the same bucket and TTL is also a cache hit. */
interface SoldQuantityIndexEntry {
  fetchedAt: number;
  byProduct: Map<string, SoldQuantityStatusMap>;
}

/**
 * How long a cached order scan stays valid before Development Tools'
 * "total sold quantity" check re-scans live orders for that time-frame
 * bucket. Paging through potentially thousands of orders is expensive
 * (tens of seconds for the longer presets), so repeated checks within this
 * window reuse the same scan instead of hitting the live Shopfa API again.
 */
const SOLD_QUANTITY_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * "Total sold quantity" is scoped by `payment_date`, not order-creation
 * `date` -- confirmed against real data that these can differ by weeks for
 * this store (bank-transfer / "اعلام پرداخت" orders in particular: sampled
 * paid orders showed gaps up to ~28 days between order date and payment
 * date). Shopfa's `/api/shop/orders` `from`/`to` filter only narrows by
 * order date, so the live scan widens its server-side fetch window by this
 * many days on the lower bound to still catch orders created earlier than
 * the requested range but paid within it, then filters precisely by
 * payment_date client-side (see scanOrdersForSoldQuantity). 45 days gives
 * comfortable margin over the largest gap observed, but an order paid even
 * later than that after being created would still be missed.
 */
const PAYMENT_DATE_LOOKBACK_BUFFER_DAYS = 45;

/**
 * Raised from an original 10s (2026-09-18) after ShopfaTransactionLog
 * showed repeated live "timeout of 10000ms exceeded" failures surfacing as
 * 502s to staff -- most, but not all, on calls requesting the admin `note`
 * field (see listOrdersByStatusForShortageReport's doc), on an otherwise
 * healthy store where the same call typically completes in well under a
 * second. 25s gives more room before treating a slow-but-alive response as
 * a failure; postWithRetry below additionally retries once before actually
 * giving up.
 */
const SHOPFA_HTTP_TIMEOUT_MS = 25_000;

/**
 * Real Shopfa HTTP integration, verified directly against the live Nilay
 * Jewelry store (see docs/architecture.md#shopfa-integration and the
 * conventions documented at the top of shopfaApiTypes.ts). Only reachable
 * when SHOPFA_MOCK=false and Settings.dataSource is "live_api".
 *
 * Every Shopfa endpoint is called with POST, but Shopfa reads every
 * parameter -- including auth -- from the query string, not the JSON body;
 * a request interceptor injects `private_key` into every call's query
 * params so call sites don't have to repeat it. Shopfa signals domain
 * errors with a `{ successful: true, error, error_code }` body on a 4xx
 * response rather than `successful: false`, so failures are detected from
 * the HTTP status (axios throws on non-2xx by default), not `successful`.
 *
 * A response/error interceptor pair also records every call (method,
 * endpoint, params with `private_key` redacted, status, duration, success)
 * to ShopfaTransactionLog for the admin Logs page -- see logTransaction().
 */
export class HttpShopfaClient implements ShopfaClient {
  private readonly http: AxiosInstance;
  /** Keyed by the time-frame preset (days) -- see SOLD_QUANTITY_CACHE_TTL_MS. */
  private readonly soldQuantityCache = new Map<SoldQuantityRangeDays, SoldQuantityIndexEntry>();
  /** Tracks an in-flight scan per bucket so concurrent requests for the same (or a differently-coded but same-bucket) product await one fetch instead of triggering duplicate live scans. */
  private readonly soldQuantityFetches = new Map<SoldQuantityRangeDays, Promise<SoldQuantityIndexEntry>>();

  constructor(baseURL: string, apiToken: string) {
    this.http = axios.create({ baseURL, timeout: SHOPFA_HTTP_TIMEOUT_MS });
    this.http.interceptors.request.use((config: RequestConfigWithTiming) => {
      config.params = { private_key: apiToken, ...config.params };
      config.shopfaLogStartedAt = Date.now();
      return config;
    });
    this.http.interceptors.response.use(
      (response) => {
        this.logTransaction(response.config, response.status, true);
        return response;
      },
      (err) => {
        if (axios.isAxiosError(err) && err.config) {
          this.logTransaction(err.config, err.response?.status ?? null, false, err.message);
        }
        return Promise.reject(err);
      },
    );
  }

  /**
   * Fire-and-forget record of one Shopfa call for the admin Logs page (see
   * ShopfaTransactionLog / shopfaTransactionLogService). `private_key` is
   * stripped from the logged params so the API token never lands at rest in
   * the database.
   */
  private logTransaction(
    config: AxiosRequestConfig,
    statusCode: number | null,
    success: boolean,
    errorMessage?: string,
  ): void {
    const startedAt = (config as RequestConfigWithTiming).shopfaLogStartedAt;
    const allParams = (config.params ?? {}) as Record<string, unknown>;
    const requestParams = Object.fromEntries(Object.entries(allParams).filter(([key]) => key !== "private_key"));
    void recordShopfaTransaction({
      method: (config.method ?? "post").toUpperCase(),
      endpoint: config.url ?? "",
      requestParams,
      statusCode,
      success,
      durationMs: startedAt ? Date.now() - startedAt : 0,
      errorMessage: errorMessage ?? null,
    });
  }

  /**
   * Retries a Shopfa call exactly once before giving up. Every call site
   * below that uses this treats ANY failure (after the retry) as a 502
   * (ApiError.badGateway) -- so retrying here is scoped to precisely the
   * failures that would otherwise become that 502, per
   * SHOPFA_HTTP_TIMEOUT_MS's doc. getOrder does NOT use this: it has a
   * legitimate non-error outcome (a 4xx that means "order not found") that
   * must never be retried, so it implements its own narrower retry that
   * only covers the failure modes that actually fall through to a 502.
   */
  private async postWithRetry<T>(url: string, body: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.http.post<T>(url, body, config);
    } catch (err) {
      logger.warn("Shopfa API call failed, retrying once", {
        url,
        err: axios.isAxiosError(err) ? err.message : String(err),
      });
      return this.http.post<T>(url, body, config);
    }
  }

  async getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    return this.getCustomerOrderSummary(externalCustomerId);
  }

  /**
   * Most storefront customers check out as guests, for whom Shopfa's
   * `user_id` is 0 -- there is no real `user_id` to look their order history
   * up by (see the comment on isZero() in shopfaApiMapper.ts). When the
   * direct `user_id` lookup comes up empty and a phone number is available
   * (e.g. from the case's customer snapshot), fall back to Shopfa's generic
   * order search filtered by that phone, which does match across a guest's
   * orders -- confirmed live: `search=<mobile>` returns only that mobile's
   * baskets, not a fuzzy/broader match. The `mobile ===` filter below is a
   * defensive re-check in case `search` ever loosens to match other fields.
   */
  async getCustomerOrderSummary(externalCustomerId: string, phone?: string): Promise<CustomerSummaryDTO | null> {
    try {
      let orders = await this.fetchOrdersByUser(externalCustomerId);
      if (orders.length === 0 && phone) {
        orders = await this.fetchOrdersByPhone(phone);
      }
      return summarizeCustomerOrders(externalCustomerId, orders);
    } catch (err) {
      logger.error("Shopfa getCustomerOrderSummary failed", { externalCustomerId, err });
      throw ApiError.badGateway("Failed to reach Shopfa customer service");
    }
  }

  async getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null> {
    const attempt = () =>
      this.http.post<ShopfaApiOrderListResponse>(
        "/api/shop/orders/details",
        {},
        { params: { id: externalOrderId } },
      );

    let data: ShopfaApiOrderListResponse;
    try {
      ({ data } = await attempt());
    } catch (err) {
      // Confirmed live: an unknown id comes back as HTTP 400 with a
      // Shopfa-specific error (e.g. "سبد وجود ندارد" / "basket doesn't
      // exist"), not 404 -- so any 4xx here is treated as "not found"
      // rather than a hard failure, and is NOT retried (it's a real,
      // deterministic answer, not a communication failure -- retrying it
      // would only waste a round trip). A 5xx or network-level error (no
      // response at all) is retried once, same as postWithRetry's other
      // callers, before surfacing as a gateway failure.
      if (axios.isAxiosError(err) && err.response && err.response.status < 500) {
        logger.info("Shopfa getOrder: order not found or rejected", {
          externalOrderId,
          status: err.response.status,
          body: err.response.data,
        });
        return null;
      }
      try {
        ({ data } = await attempt());
      } catch (retryErr) {
        logger.error("Shopfa getOrder failed", { externalOrderId, err: retryErr });
        throw ApiError.badGateway("Failed to reach Shopfa order service");
      }
    }
    const raw = extractOrderDetails(data);
    return raw ? mapApiOrderToSummary(raw) : null;
  }

  async searchCustomer(query: string): Promise<CustomerSearchResultDTO[]> {
    try {
      const { data } = await this.postWithRetry<ShopfaApiUserListResponse>(
        "/api/user/users",
        {},
        { params: { q: query, limit: 20 } },
      );
      return readUserItems(data).map(mapApiUserToSearchResult);
    } catch (err) {
      logger.error("Shopfa searchCustomer failed", { query, err });
      throw ApiError.badGateway("Failed to reach Shopfa customer service");
    }
  }

  async searchOrders(query: string): Promise<OrderSummaryDTO[]> {
    try {
      const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
        "/api/shop/orders",
        {},
        { params: { search: query, limit: 20 } },
      );
      return readOrderBaskets(data).map(mapApiOrderToSummary);
    } catch (err) {
      logger.error("Shopfa searchOrders failed", { query, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  /**
   * Confirmed live: /api/shop/product/list filtered by `id` returns exactly
   * one matching product when found. Unlike getOrder below, a non-matching
   * id does NOT come back as a 4xx -- it's still HTTP 200 with
   * `items: [], total_count: 0, error: "Not Found"` (successful stays
   * true), so "not found" is detected from the empty items array, not the
   * response status or the `error`/`successful` fields.
   */
  async getProductByCode(code: string): Promise<ShopfaProductLookup | null> {
    try {
      const { data } = await this.postWithRetry<ShopfaApiProductListResponse>(
        "/api/shop/product/list",
        {},
        { params: { id: code, limit: 1 } },
      );
      const raw = readProductItems(data)[0];
      return raw ? mapApiProductToLookup(raw) : null;
    } catch (err) {
      logger.error("Shopfa getProductByCode failed", { code, err });
      throw ApiError.badGateway("Failed to reach Shopfa product service");
    }
  }

  /** Confirmed live: `q` performs a free-text search (title, among other indexed fields) across the product catalog, for Match & Register's "search by name" flow. */
  async searchProducts(query: string): Promise<ShopfaProductLookup[]> {
    try {
      const { data } = await this.postWithRetry<ShopfaApiProductListResponse>(
        "/api/shop/product/list",
        {},
        { params: { q: query, limit: 20 } },
      );
      return readProductItems(data).map(mapApiProductToLookup);
    } catch (err) {
      logger.error("Shopfa searchProducts failed", { query, err });
      throw ApiError.badGateway("Failed to reach Shopfa product service");
    }
  }

  /**
   * Confirmed live: /api/shop/orders has no server-side filter by product
   * (a `product_id`/`item_id`/`product` param is silently ignored), so
   * getting a per-product total means paging through every order in the
   * date range regardless of which product was asked for. Since that scan
   * already reads every basket's items, getSoldQuantityIndex below indexes
   * ALL product codes seen (not just this one) and caches the result per
   * time-frame bucket -- see SOLD_QUANTITY_CACHE_TTL_MS -- so a later check
   * for a *different* product against the same bucket within the TTL is an
   * in-memory lookup instead of another live scan.
   */
  async getSoldQuantityBreakdown(productCode: string, range: ShopfaDateRange): Promise<ShopfaSoldQuantityResult> {
    const { entry, servedFromCache } = await this.getSoldQuantityIndex(range);
    const byStatus = entry.byProduct.get(productCode);
    const rows: ShopfaSoldQuantityStatusRow[] = byStatus
      ? Array.from(byStatus.entries()).map(([status, { quantity, orderIds }]) => ({
          status,
          quantity,
          orderCount: orderIds.size,
        }))
      : [];
    return { rows, fetchedAt: new Date(entry.fetchedAt), servedFromCache };
  }

  private async getSoldQuantityIndex(
    range: ShopfaDateRange,
  ): Promise<{ entry: SoldQuantityIndexEntry; servedFromCache: boolean }> {
    const cached = this.soldQuantityCache.get(range.days);
    if (cached && Date.now() - cached.fetchedAt < SOLD_QUANTITY_CACHE_TTL_MS) {
      return { entry: cached, servedFromCache: true };
    }

    const pending = this.soldQuantityFetches.get(range.days);
    if (pending) {
      return { entry: await pending, servedFromCache: false };
    }

    const fetchPromise = this.scanOrdersForSoldQuantity(range).then((entry) => {
      this.soldQuantityCache.set(range.days, entry);
      return entry;
    });
    this.soldQuantityFetches.set(range.days, fetchPromise);
    try {
      return { entry: await fetchPromise, servedFromCache: false };
    } finally {
      this.soldQuantityFetches.delete(range.days);
    }
  }

  /**
   * `from`/`to` are unix seconds (confirmed live -- a date string is
   * rejected) and filter by order-creation `date`, the only date Shopfa's
   * `/api/shop/orders` can filter by server-side. Since the report is
   * scoped by `payment_date` (see PAYMENT_DATE_LOOKBACK_BUFFER_DAYS), the
   * fetch window's lower bound is padded by that buffer so orders created
   * just before the requested range but paid within it are still fetched,
   * then each basket's *effective* date -- its payment_date when the order
   * was actually paid, falling back to its creation date for orders that
   * never were (e.g. an abandoned checkout form has no payment_date) -- is
   * checked against the exact requested range before it's indexed. Sequential,
   * not parallel, paging on purpose: this hits the live production store,
   * and the caller (Development Tools) already lets the user bound the
   * cost via the time-frame picker.
   */
  private async scanOrdersForSoldQuantity(range: ShopfaDateRange): Promise<SoldQuantityIndexEntry> {
    const PAGE_SIZE = 500;
    const byProduct = new Map<string, SoldQuantityStatusMap>();
    const rangeFromSec = Math.floor(range.from.getTime() / 1000);
    const rangeToSec = Math.floor(range.to.getTime() / 1000);
    const fetchFromSec = rangeFromSec - PAYMENT_DATE_LOOKBACK_BUFFER_DAYS * 24 * 60 * 60;
    try {
      for (let page = 1; ; page += 1) {
        const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
          "/api/shop/orders",
          {},
          {
            params: {
              from: fetchFromSec,
              to: rangeToSec,
              limit: PAGE_SIZE,
              page,
              sort: "date",
              order: "desc",
            },
          },
        );
        const baskets = data.baskets ?? [];
        for (const basket of baskets) {
          const paymentDateSec = Number(basket.payment_date) || 0;
          const effectiveDateSec = paymentDateSec > 0 ? paymentDateSec : Number(basket.date) || 0;
          if (effectiveDateSec < rangeFromSec || effectiveDateSec > rangeToSec) continue;

          const status = basket.status_title || String(basket.status);
          for (const item of basket.items ?? []) {
            const quantity = Number(item.count) || 0;
            if (quantity <= 0) continue;
            const code = String(item.product_id);
            let statusMap = byProduct.get(code);
            if (!statusMap) {
              statusMap = new Map();
              byProduct.set(code, statusMap);
            }
            const entry = statusMap.get(status) ?? { quantity: 0, orderIds: new Set<string | number>() };
            entry.quantity += quantity;
            entry.orderIds.add(basket.id);
            statusMap.set(status, entry);
          }
        }
        if (baskets.length < PAGE_SIZE) break;
      }
    } catch (err) {
      logger.error("Shopfa order scan for sold-quantity failed", { days: range.days, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    return { fetchedAt: Date.now(), byProduct };
  }

  /**
   * See the ShopfaClient interface doc: a minimal `{id, title}` body is
   * enough, and re-fetching afterward is what actually confirms the write
   * landed, since the update call's own response can't be trusted.
   */
  async updateProductTitle(productCode: string, title: string): Promise<ShopfaProductLookup | null> {
    try {
      await this.postWithRetry("/api/shop/product/update", { id: productCode, title });
    } catch (err) {
      logger.error("Shopfa updateProductTitle failed", { productCode, err });
      throw ApiError.badGateway("Failed to reach Shopfa product service");
    }
    return this.getProductByCode(productCode);
  }

  /**
   * See the ShopfaClient interface doc: `note` has to be requested
   * explicitly via `fields`, and `search` is used (there's no dedicated
   * "by session" filter) then filtered client-side for an exact `session`
   * match, since `search` is a general free-text match across order
   * fields.
   */
  async getOrderAdminNote(orderNumber: string): Promise<ShopfaOrderAdminNote | null> {
    try {
      const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
        "/api/shop/orders",
        {},
        { params: { search: orderNumber, limit: 5, fields: "id,session,note" } },
      );
      const raw = (data.baskets ?? []).find((b) => String(b.session) === orderNumber);
      if (!raw) return null;
      return { externalOrderId: String(raw.id), orderNumber: String(raw.session ?? raw.id), note: raw.note ?? "" };
    } catch (err) {
      logger.error("Shopfa getOrderAdminNote failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  /**
   * See the ShopfaClient interface doc for why the write key is `note`,
   * not `description`. `id` (the internal basket id, resolved from the
   * order number first) is sent both as a query param and in the JSON
   * body -- Shopfa's orders endpoints have been observed to silently
   * ignore an `id` that's only in one place (see shopfaApiTypes.ts's
   * top-of-file conventions).
   */
  async updateOrderAdminNote(orderNumber: string, note: string): Promise<ShopfaOrderAdminNote | null> {
    const existing = await this.getOrderAdminNote(orderNumber);
    if (!existing) return null;
    try {
      await this.postWithRetry(
        "/api/shop/orders/update",
        { id: existing.externalOrderId, note },
        { params: { id: existing.externalOrderId } },
      );
    } catch (err) {
      logger.error("Shopfa updateOrderAdminNote failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    return this.getOrderAdminNote(orderNumber);
  }

  /**
   * See the ShopfaClient interface doc: one paginated scan per status
   * code, since Shopfa's `status` filter rejects a comma-separated list.
   * `note` has to be requested explicitly via `fields` (see
   * getOrderAdminNote above) alongside the other fields this report
   * needs; `items` comes back regardless of `fields`.
   *
   * Confirmed live (2026-09-16) that requesting `note` at this client's
   * usual PAGE_SIZE of 500 makes Shopfa itself dramatically slower and
   * occasionally unresponsive past this.http's timeout (see
   * SHOPFA_HTTP_TIMEOUT_MS) -- one 500-row page ranged from 1.5s to a 30s+
   * stall across repeated identical calls; every 100-row page tried was
   * consistently fast (well under 2s), though even that isn't immune to
   * occasional stalls (hence postWithRetry). Reads that don't request
   * `note` (getSoldQuantityIndex above) don't show this and can stay at
   * 500.
   */
  async listOrdersByStatusForShortageReport(
    statusCodes: number[],
    range: ShopfaOrderDateWindow,
  ): Promise<ShopfaShortageReportOrder[]> {
    const PAGE_SIZE = 100;
    const fromSec = Math.floor(range.from.getTime() / 1000);
    const toSec = Math.floor(range.to.getTime() / 1000);
    const results: ShopfaShortageReportOrder[] = [];
    try {
      for (const statusCode of statusCodes) {
        for (let page = 1; ; page += 1) {
          const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
            "/api/shop/orders",
            {},
            {
              params: {
                status: statusCode,
                from: fromSec,
                to: toSec,
                limit: PAGE_SIZE,
                page,
                fields: "id,session,note,payment_date,date",
              },
            },
          );
          const baskets = data.baskets ?? [];
          results.push(...baskets.map(mapApiOrderToShortageReportOrder));
          if (baskets.length < PAGE_SIZE) break;
        }
      }
    } catch (err) {
      logger.error("Shopfa listOrdersByStatusForShortageReport failed", { statusCodes, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    return results;
  }

  /**
   * See the ShopfaClient interface doc: one paginated scan per status code
   * (same constraint as listOrdersByStatusForShortageReport), no date bound
   * -- Order Precheck's queues are meant to stay small. `note` has to be
   * requested explicitly via `fields`, so this pages at 100 rows for the
   * same reason listOrdersByStatusForShortageReport does (see that
   * method's doc and the shopfa-api-testing-fixtures memory: requesting
   * `note` at 500 rows/page made Shopfa itself intermittently stall past
   * this.http's timeout, see SHOPFA_HTTP_TIMEOUT_MS).
   */
  async listOrdersByStatusForPrecheck(statusCodes: number[]): Promise<ShopfaPrecheckOrder[]> {
    const PAGE_SIZE = 100;
    const results: ShopfaPrecheckOrder[] = [];
    try {
      for (const statusCode of statusCodes) {
        for (let page = 1; ; page += 1) {
          const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
            "/api/shop/orders",
            {},
            {
              params: {
                status: statusCode,
                limit: PAGE_SIZE,
                page,
                sort: "date",
                order: "desc",
                fields: "id,session,note,date,status,status_title,name,family",
              },
            },
          );
          const baskets = data.baskets ?? [];
          results.push(...baskets.map((raw) => mapApiOrderToPrecheckOrder(raw, statusCode)));
          if (baskets.length < PAGE_SIZE) break;
        }
      }
    } catch (err) {
      logger.error("Shopfa listOrdersByStatusForPrecheck failed", { statusCodes, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    return results;
  }

  /**
   * See the ShopfaClient interface doc: both `note` and `status` are
   * confirmed live in the same write. `id` is resolved via
   * getOrderAdminNote first, same as updateOrderAdminNote.
   */
  async updateOrderNoteAndStatus(
    orderNumber: string,
    update: ShopfaOrderPrecheckUpdate,
  ): Promise<ShopfaOrderPrecheckUpdateResult | null> {
    const existing = await this.getOrderAdminNote(orderNumber);
    if (!existing) return null;
    try {
      await this.postWithRetry(
        "/api/shop/orders/update",
        { id: existing.externalOrderId, note: update.note, status: update.statusCode },
        { params: { id: existing.externalOrderId } },
      );
    } catch (err) {
      logger.error("Shopfa updateOrderNoteAndStatus failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    try {
      const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
        "/api/shop/orders",
        {},
        { params: { search: orderNumber, limit: 5, fields: "id,session,note,status,status_title" } },
      );
      const raw = (data.baskets ?? []).find((b) => String(b.session) === orderNumber);
      if (!raw) return null;
      return {
        externalOrderId: String(raw.id),
        orderNumber: String(raw.session ?? raw.id),
        note: raw.note ?? "",
        statusCode: Number(raw.status),
        statusTitle: raw.status_title ?? String(raw.status),
      };
    } catch (err) {
      logger.error("Shopfa updateOrderNoteAndStatus re-fetch failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  /**
   * See the ShopfaClient interface doc: no `note` in `fields`, so this pages
   * at the client's normal 500-row size instead of the 100 rows
   * listOrdersByStatusForPrecheck/ForShortageReport are limited to.
   */
  async listOrdersByStatusForPacking(
    statusCode: number,
    range: ShopfaOrderDateWindow,
  ): Promise<ShopfaPackingOrder[]> {
    const PAGE_SIZE = 500;
    const fromSec = Math.floor(range.from.getTime() / 1000);
    const toSec = Math.floor(range.to.getTime() / 1000);
    const results: ShopfaPackingOrder[] = [];
    try {
      for (let page = 1; ; page += 1) {
        const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
          "/api/shop/orders",
          {},
          {
            params: {
              status: statusCode,
              from: fromSec,
              to: toSec,
              limit: PAGE_SIZE,
              page,
              sort: "date",
              order: "desc",
              fields: "id,session,date,status,status_title,name,family",
            },
          },
        );
        const baskets = data.baskets ?? [];
        results.push(...baskets.map((raw) => mapApiOrderToPackingOrder(raw, statusCode)));
        if (baskets.length < PAGE_SIZE) break;
      }
    } catch (err) {
      logger.error("Shopfa listOrdersByStatusForPacking failed", { statusCode, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
    return results;
  }

  /**
   * See the ShopfaClient interface doc: only `status` is sent, relying on
   * partial-update/merge semantics to leave `note` (and everything else)
   * untouched. `id` is resolved via a lightweight search (no `note` in
   * `fields`) rather than reusing getOrderAdminNote, since that would incur
   * the slower note-bearing lookup for no reason here.
   */
  async updateOrderStatus(orderNumber: string, statusCode: number): Promise<ShopfaOrderStatusUpdateResult | null> {
    let internalId: string;
    try {
      const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
        "/api/shop/orders",
        {},
        { params: { search: orderNumber, limit: 5, fields: "id,session" } },
      );
      const raw = (data.baskets ?? []).find((b) => String(b.session) === orderNumber);
      if (!raw) return null;
      internalId = String(raw.id);
    } catch (err) {
      logger.error("Shopfa updateOrderStatus lookup failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }

    try {
      await this.postWithRetry(
        "/api/shop/orders/update",
        { id: internalId, status: statusCode },
        { params: { id: internalId } },
      );
    } catch (err) {
      logger.error("Shopfa updateOrderStatus failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }

    try {
      const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
        "/api/shop/orders",
        {},
        { params: { search: orderNumber, limit: 5, fields: "id,session,status,status_title" } },
      );
      const raw = (data.baskets ?? []).find((b) => String(b.session) === orderNumber);
      if (!raw) return null;
      return {
        orderNumber: String(raw.session ?? raw.id),
        statusCode: Number(raw.status),
        statusTitle: raw.status_title ?? String(raw.status),
      };
    } catch (err) {
      logger.error("Shopfa updateOrderStatus re-fetch failed", { orderNumber, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  private async fetchOrdersByUser(userId: string): Promise<ShopfaApiOrder[]> {
    const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
      "/api/shop/orders",
      {},
      { params: { user_id: userId, limit: 200, sort: "date", order: "desc" } },
    );
    return readOrderBaskets(data);
  }

  private async fetchOrdersByPhone(phone: string): Promise<ShopfaApiOrder[]> {
    const { data } = await this.postWithRetry<ShopfaApiOrderListResponse>(
      "/api/shop/orders",
      {},
      { params: { search: phone, limit: 200, sort: "date", order: "desc" } },
    );
    return readOrderBaskets(data).filter((order) => order.mobile === phone);
  }
}
