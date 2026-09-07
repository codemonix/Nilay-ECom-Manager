import type {
  ApiResponse,
  CustomerSearchResultDTO,
  CustomerSummaryDTO,
  OrderSummaryDTO,
} from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const customersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerSummary: builder.query<CustomerSummaryDTO, string>({
      query: (externalCustomerId) => `/customers/${externalCustomerId}/summary`,
      transformResponse: (response: ApiResponse<CustomerSummaryDTO>) => unwrap(response),
    }),

    searchCustomers: builder.query<CustomerSearchResultDTO[], string>({
      query: (q) => ({ url: "/customers/search", params: { q } }),
      transformResponse: (response: ApiResponse<CustomerSearchResultDTO[]>) => unwrap(response),
    }),

    /** Read-only order lookup against the shop (live Shopfa API or mock, per the Settings data-source toggle) -- used by case creation to match a real order. Never creates/updates/deletes anything on Shopfa. */
    searchShopOrders: builder.query<OrderSummaryDTO[], string>({
      query: (q) => ({ url: "/customers/orders/search", params: { q } }),
      transformResponse: (response: ApiResponse<OrderSummaryDTO[]>) => unwrap(response),
    }),
  }),
});

export const {
  useGetCustomerSummaryQuery,
  useLazySearchCustomersQuery,
  useLazySearchShopOrdersQuery,
} = customersApi;
