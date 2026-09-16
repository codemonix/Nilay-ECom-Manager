import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { PurchasingOverviewDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const purchasingOverviewApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPurchasingOverview: builder.query<PurchasingOverviewDTO, void>({
      query: () => "/purchasing/overview",
      transformResponse: (response: ApiResponse<PurchasingOverviewDTO>) => unwrap(response),
      providesTags: [{ type: "PurchasingOverview", id: "SINGLETON" }],
    }),
  }),
});

export const { useGetPurchasingOverviewQuery } = purchasingOverviewApi;
