import type { ApiResponse, SystemLogDTO, UserActivityLogDTO, ShopfaTransactionLogDTO } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  ListSystemLogsParams,
  ListUserActivityLogsParams,
  ListShopfaTransactionLogsParams,
  SystemLogListResult,
  UserActivityLogListResult,
  ShopfaTransactionLogListResult,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function toPagedResult<T>(response: ApiResponse<T[]> & { meta?: ApiMeta }) {
  const items = unwrap(response);
  const meta = response.meta;
  return {
    items,
    page: meta?.page ?? 1,
    pageSize: meta?.pageSize ?? items.length,
    total: meta?.total ?? items.length,
    totalPages: meta?.totalPages ?? 1,
  };
}

export const logsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listSystemLogs: builder.query<SystemLogListResult, ListSystemLogsParams>({
      query: (params) => ({ url: "/logs/system", params }),
      transformResponse: (response: ApiResponse<SystemLogDTO[]> & { meta?: ApiMeta }) => toPagedResult(response),
      providesTags: [{ type: "SystemLogList", id: "LIST" }],
    }),

    listUserActivityLogs: builder.query<UserActivityLogListResult, ListUserActivityLogsParams>({
      query: (params) => ({ url: "/logs/user-activity", params }),
      transformResponse: (response: ApiResponse<UserActivityLogDTO[]> & { meta?: ApiMeta }) => toPagedResult(response),
      providesTags: [{ type: "UserActivityLogList", id: "LIST" }],
    }),

    listShopfaTransactionLogs: builder.query<ShopfaTransactionLogListResult, ListShopfaTransactionLogsParams>({
      query: (params) => ({ url: "/logs/shopfa-transactions", params }),
      transformResponse: (response: ApiResponse<ShopfaTransactionLogDTO[]> & { meta?: ApiMeta }) =>
        toPagedResult(response),
      providesTags: [{ type: "ShopfaTransactionLogList", id: "LIST" }],
    }),
  }),
});

export const { useListSystemLogsQuery, useListUserActivityLogsQuery, useListShopfaTransactionLogsQuery } = logsApi;
