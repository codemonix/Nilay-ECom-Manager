import type { ApiResponse, ImportedOrderDTO } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { ImportedOrderListResult } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

interface ListImportedOrdersParams {
  page: number;
  pageSize: number;
  search?: string;
}

export const importedOrdersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listImportedOrders: builder.query<ImportedOrderListResult, ListImportedOrdersParams>({
      query: (params) => ({ url: "/orders", params }),
      transformResponse: (
        response: ApiResponse<ImportedOrderDTO[]> & {
          meta?: { page: number; pageSize: number; total: number; totalPages: number };
        },
      ) => {
        const items = unwrap(response);
        const meta = response.meta;
        return {
          items,
          page: meta?.page ?? 1,
          pageSize: meta?.pageSize ?? items.length,
          total: meta?.total ?? items.length,
          totalPages: meta?.totalPages ?? 1,
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((o) => ({ type: "ImportedOrder" as const, id: o.id })),
              { type: "ImportedOrderList" as const, id: "LIST" },
            ]
          : [{ type: "ImportedOrderList" as const, id: "LIST" }],
    }),
  }),
});

export const { useListImportedOrdersQuery, useLazyListImportedOrdersQuery } = importedOrdersApi;
