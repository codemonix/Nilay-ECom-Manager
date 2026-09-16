import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { MatchPreviewDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const shopfaProductsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Free-text Shopfa product search by name, for Match & Register's "search by name" flow -- no cache tags, purely read-through to Shopfa. */
    searchShopfaProducts: builder.query<MatchPreviewDTO[], string>({
      query: (q) => ({ url: "/shopfa/products/search", params: { q } }),
      transformResponse: (response: ApiResponse<MatchPreviewDTO[]>) => unwrap(response),
    }),
  }),
});

export const { useSearchShopfaProductsQuery, useLazySearchShopfaProductsQuery } = shopfaProductsApi;
