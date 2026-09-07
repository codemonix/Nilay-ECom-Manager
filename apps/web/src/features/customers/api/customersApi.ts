import type { ApiResponse, CustomerSearchResultDTO, CustomerSummaryDTO } from "@complaint-system/shared";
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
  }),
});

export const { useGetCustomerSummaryQuery, useLazySearchCustomersQuery } = customersApi;
