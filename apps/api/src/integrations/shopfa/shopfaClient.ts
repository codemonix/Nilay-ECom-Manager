import axios, { type AxiosInstance } from "axios";
import type {
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import type { ShopfaClient, ShopfaRawCustomer, ShopfaRawOrder } from "./shopfaTypes";
import { mapCustomerToSearchResult, mapCustomerToSummary, mapOrderToSummary } from "./shopfaMapper";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/ApiError";

/** Real Shopfa HTTP integration. Only reachable when SHOPFA_MOCK=false and credentials are configured. */
export class HttpShopfaClient implements ShopfaClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string, apiToken: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
    });
  }

  async getCustomer(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    return this.getCustomerOrderSummary(externalCustomerId);
  }

  async getCustomerOrderSummary(externalCustomerId: string): Promise<CustomerSummaryDTO | null> {
    try {
      const { data } = await this.http.get<ShopfaRawCustomer>(`/customers/${externalCustomerId}`);
      const { data: orders } = await this.http.get<ShopfaRawOrder[]>(
        `/customers/${externalCustomerId}/orders`,
      );
      return mapCustomerToSummary(data, orders);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      logger.error("Shopfa getCustomerOrderSummary failed", { externalCustomerId, err });
      throw ApiError.badGateway("Failed to reach Shopfa customer service");
    }
  }

  async getOrder(externalOrderId: string): Promise<OrderSummaryDTO | null> {
    try {
      const { data } = await this.http.get<ShopfaRawOrder>(`/orders/${externalOrderId}`);
      return mapOrderToSummary(data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      logger.error("Shopfa getOrder failed", { externalOrderId, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }

  async searchCustomer(query: string): Promise<CustomerSearchResultDTO[]> {
    try {
      const { data } = await this.http.get<ShopfaRawCustomer[]>("/customers/search", {
        params: { q: query },
      });
      return data.map(mapCustomerToSearchResult);
    } catch (err) {
      logger.error("Shopfa searchCustomer failed", { query, err });
      throw ApiError.badGateway("Failed to reach Shopfa customer service");
    }
  }

  async searchOrders(query: string): Promise<OrderSummaryDTO[]> {
    try {
      const { data } = await this.http.get<ShopfaRawOrder[]>("/orders/search", {
        params: { q: query },
      });
      return data.map(mapOrderToSummary);
    } catch (err) {
      logger.error("Shopfa searchOrders failed", { query, err });
      throw ApiError.badGateway("Failed to reach Shopfa order service");
    }
  }
}
