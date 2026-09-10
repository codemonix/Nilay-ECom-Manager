import type { ApiResponse, DataSource, SystemLogLevel } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { AppSettingsDTO, ImportOrdersResultDTO, ShopfaConnectionTestResultDTO, LogSizesDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<AppSettingsDTO, void>({
      query: () => "/settings",
      transformResponse: (response: ApiResponse<AppSettingsDTO>) => unwrap(response),
      providesTags: ["Settings"],
    }),

    updateDataSource: builder.mutation<AppSettingsDTO, DataSource>({
      query: (dataSource) => ({ url: "/settings/data-source", method: "PATCH", body: { dataSource } }),
      transformResponse: (response: ApiResponse<AppSettingsDTO>) => unwrap(response),
      invalidatesTags: ["Settings"],
    }),

    testShopfaConnection: builder.mutation<ShopfaConnectionTestResultDTO, void>({
      query: () => ({ url: "/settings/shopfa/test-connection", method: "POST" }),
      transformResponse: (response: ApiResponse<ShopfaConnectionTestResultDTO>) => unwrap(response),
    }),

    updateSystemLogLevel: builder.mutation<AppSettingsDTO, SystemLogLevel>({
      query: (systemLogLevel) => ({ url: "/settings/log-level", method: "PATCH", body: { systemLogLevel } }),
      transformResponse: (response: ApiResponse<AppSettingsDTO>) => unwrap(response),
      invalidatesTags: ["Settings"],
    }),

    getLogSizes: builder.query<LogSizesDTO, void>({
      query: () => "/settings/log-sizes",
      transformResponse: (response: ApiResponse<LogSizesDTO>) => unwrap(response),
      providesTags: ["LogSizes"],
    }),

    importOrdersFile: builder.mutation<ImportOrdersResultDTO, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: "/settings/orders/import", method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<ImportOrdersResultDTO>) => unwrap(response),
      invalidatesTags: ["Settings", "ImportedOrderList"],
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateDataSourceMutation,
  useUpdateSystemLogLevelMutation,
  useGetLogSizesQuery,
  useTestShopfaConnectionMutation,
  useImportOrdersFileMutation,
} = settingsApi;
