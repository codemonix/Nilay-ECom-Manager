import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  PackingListResultDTO,
  PackingRangeDays,
  PackingRecordDTO,
  PackingRecordItemDTO,
  PackingRecordListResult,
  SendPackedOrderResultDTO,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ListPackingOrdersArgs {
  days: PackingRangeDays;
}

export interface SendPackedOrderArgs {
  orderNumber: string;
  externalOrderId: string;
  buyerName: string | null;
  items: PackingRecordItemDTO[];
  /** Undefined when staff explicitly sent without a confirmation photo (the warning dialog's "Confirm" override). */
  photo?: File;
}

export interface ListPackingHistoryArgs {
  page: number;
  pageSize: number;
  search?: string;
}

export const packingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Every order currently "ارسال شده به سرویس پستی" created within the last `days` days -- see PackingListResultDTO. */
    listPackingOrders: builder.query<PackingListResultDTO, ListPackingOrdersArgs>({
      query: ({ days }) => ({ url: "/packing/orders", params: { days } }),
      transformResponse: (response: ApiResponse<PackingListResultDTO>) => unwrap(response),
      providesTags: ["PackingList"],
    }),
    /** Multipart: an optional confirmation photo alongside a JSON snapshot of the order (see packingService.markOrderPacked for why the snapshot, not a re-fetch, is authoritative here). */
    sendPackedOrder: builder.mutation<SendPackedOrderResultDTO, SendPackedOrderArgs>({
      query: ({ orderNumber, externalOrderId, buyerName, items, photo }) => {
        const formData = new FormData();
        formData.append("externalOrderId", externalOrderId);
        if (buyerName) formData.append("buyerName", buyerName);
        formData.append("items", JSON.stringify(items));
        if (photo) formData.append("photo", photo);
        return { url: `/packing/orders/${orderNumber}/send`, method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<SendPackedOrderResultDTO>) => unwrap(response),
      invalidatesTags: ["PackingList", { type: "PackingHistoryList", id: "LIST" }],
    }),
    listPackingHistory: builder.query<PackingRecordListResult, ListPackingHistoryArgs>({
      query: (params) => ({ url: "/packing/history", params }),
      transformResponse: (
        response: ApiResponse<PackingRecordDTO[]> & {
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
      providesTags: [{ type: "PackingHistoryList", id: "LIST" }],
    }),
  }),
});

export const { useLazyListPackingOrdersQuery, useSendPackedOrderMutation, useListPackingHistoryQuery } = packingApi;
