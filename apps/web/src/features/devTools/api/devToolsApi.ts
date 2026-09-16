import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  OrderAdminNoteDTO,
  SoldItemSearchResultDTO,
  SoldQuantityRangeDays,
  SoldQuantityResultDTO,
  TitleAsteriskCheckResultDTO,
  ToggleTitleAsteriskResultDTO,
  UpdateOrderAdminNoteResultDTO,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface GetSoldQuantityArgs {
  productCode: string;
  days: SoldQuantityRangeDays;
}

export const devToolsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Free-text search by name, delegated server-side to the active Shopfa client -- for the "search by name and pick" flow. */
    searchDevToolsItems: builder.query<SoldItemSearchResultDTO[], string>({
      query: (q) => ({ url: "/dev-tools/products/search", params: { q } }),
      transformResponse: (response: ApiResponse<SoldItemSearchResultDTO[]>) => unwrap(response),
    }),
    /** Total quantity sold for an exact product code within the given time frame. */
    getSoldQuantity: builder.query<SoldQuantityResultDTO, GetSoldQuantityArgs>({
      query: ({ productCode, days }) => ({
        url: `/dev-tools/products/${encodeURIComponent(productCode)}/sold-quantity`,
        params: { days },
      }),
      transformResponse: (response: ApiResponse<SoldQuantityResultDTO>) => unwrap(response),
    }),
    /** Looks up a product by code and reports whether its title currently ends in "*", plus a deep link to edit it manually in the Shopfa admin dashboard (see TitleAsteriskCheckResultDTO). */
    checkTitleAsterisk: builder.query<TitleAsteriskCheckResultDTO, string>({
      query: (productCode) => `/dev-tools/products/${encodeURIComponent(productCode)}/title-asterisk`,
      transformResponse: (response: ApiResponse<TitleAsteriskCheckResultDTO>) => unwrap(response),
    }),
    /** Flips the trailing "*" on a product's title; only reliable against the live API -- see ToggleTitleAsteriskResultDTO.applied. */
    toggleTitleAsterisk: builder.mutation<ToggleTitleAsteriskResultDTO, string>({
      query: (productCode) => ({
        url: `/dev-tools/products/${encodeURIComponent(productCode)}/title-asterisk/toggle`,
        method: "POST",
      }),
      transformResponse: (response: ApiResponse<ToggleTitleAsteriskResultDTO>) => unwrap(response),
    }),
    /** Looks up an order by its customer-facing order number and returns its admin note ("یادداشت مدیر" in the Shopfa dashboard); only available against the live API -- see OrderAdminNoteDTO. */
    getOrderAdminNote: builder.query<OrderAdminNoteDTO, string>({
      query: (orderNumber) => `/dev-tools/orders/${encodeURIComponent(orderNumber)}/admin-note`,
      transformResponse: (response: ApiResponse<OrderAdminNoteDTO>) => unwrap(response),
    }),
    /** Sets an order's admin note; see UpdateOrderAdminNoteResultDTO.applied for why the write is re-verified rather than trusted outright. */
    updateOrderAdminNote: builder.mutation<UpdateOrderAdminNoteResultDTO, { orderNumber: string; note: string }>({
      query: ({ orderNumber, note }) => ({
        url: `/dev-tools/orders/${encodeURIComponent(orderNumber)}/admin-note`,
        method: "POST",
        body: { note },
      }),
      transformResponse: (response: ApiResponse<UpdateOrderAdminNoteResultDTO>) => unwrap(response),
    }),
  }),
});

export const {
  useSearchDevToolsItemsQuery,
  useLazySearchDevToolsItemsQuery,
  useGetSoldQuantityQuery,
  useLazyGetSoldQuantityQuery,
  useLazyCheckTitleAsteriskQuery,
  useToggleTitleAsteriskMutation,
  useLazyGetOrderAdminNoteQuery,
  useUpdateOrderAdminNoteMutation,
} = devToolsApi;
