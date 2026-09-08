import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type { ShopfaClient } from "./shopfaTypes";
import type { ShopfaApiOrder, ShopfaApiOrderListResponse, ShopfaApiUserListResponse } from "./shopfaApiTypes";
import {
  extractOrderDetails,
  mapApiOrderToSummary,
  mapApiUserToSearchResult,
  readOrderBaskets,
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

  constructor(baseURL: string, apiToken: string) {
    this.http = axios.create({ baseURL, timeout: 10_000 });
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
    try {
      const { data } = await this.http.post<ShopfaApiOrderListResponse>(
        "/api/shop/orders/details",
        {},
        { params: { id: externalOrderId } },
      );
      const raw = extractOrderDetails(data);
      return raw ? mapApiOrderToSummary(raw) : null;
    } catch (err) {
      // Confirmed live: an unknown id comes back as HTTP 400 with a
      // Shopfa-specific error (e.g. "سبد وجود ندارد" / "basket doesn't
      // exist"), not 404 -- so any 4xx here is treated as "not found"
      // rather than a hard failure. A 5xx or network-level error (no
      // response at all) still surfaces as a gateway failure.
      if (axios.isAxiosError(err) && err.response && err.response.status < 500) {
        logger.info("Shopfa getOrder: order not found or rejected", {
          externalOrderId,
          status: err.response.status,
          body: err.response.data,
        });
        return null;
      }
      logger.error("Shopfa getOrder failed", { externalOrderId, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  async searchCustomer(query: string): Promise<CustomerSearchResultDTO[]> {
    try {
      const { data } = await this.http.post<ShopfaApiUserListResponse>(
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
      const { data } = await this.http.post<ShopfaApiOrderListResponse>(
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

  private async fetchOrdersByUser(userId: string): Promise<ShopfaApiOrder[]> {
    const { data } = await this.http.post<ShopfaApiOrderListResponse>(
      "/api/shop/orders",
      {},
      { params: { user_id: userId, limit: 200, sort: "date", order: "desc" } },
    );
    return readOrderBaskets(data);
  }

  private async fetchOrdersByPhone(phone: string): Promise<ShopfaApiOrder[]> {
    const { data } = await this.http.post<ShopfaApiOrderListResponse>(
      "/api/shop/orders",
      {},
      { params: { search: phone, limit: 200, sort: "date", order: "desc" } },
    );
    return readOrderBaskets(data).filter((order) => order.mobile === phone);
  }
}
