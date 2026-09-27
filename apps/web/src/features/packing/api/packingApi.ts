import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  OrderHistoryDTO,
  PackingCustomerOrdersDTO,
  PackingListResultDTO,
  PackingRangeDays,
  PackingRecordDTO,
  PackingRecordItemDTO,
  PackingRecordListResult,
  SendPackedOrderResultDTO,
  SendPackedOrdersResultDTO,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ListPackingOrdersArgs {
  days: PackingRangeDays;
}

export interface SendPackedOrdersArgs {
  /** Every order of the customer group being sent -- the server trusts this snapshot (see packingService.markOrderPacked). */
  orders: { orderNumber: string; externalOrderId: string; buyerName: string | null; items: PackingRecordItemDTO[] }[];
  /** The group's confirmation photos; empty when staff chose "save and continue" without any. */
  photos: File[];
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
    /** Multipart: the group's confirmation photos alongside a JSON snapshot of its orders. Orders succeed or fail individually -- see SendPackedOrdersResultDTO. */
    sendPackedOrders: builder.mutation<SendPackedOrdersResultDTO, SendPackedOrdersArgs>({
      query: ({ orders, photos }) => {
        const formData = new FormData();
        formData.append("orders", JSON.stringify(orders));
        for (const photo of photos) formData.append("photos", photo);
        return { url: "/packing/send", method: "POST", body: formData };
      },
      transformResponse: (response: ApiResponse<SendPackedOrdersResultDTO>) => unwrap(response),
      invalidatesTags: ["PackingList", { type: "PackingHistoryList", id: "LIST" }],
    }),
    /** Opening a customer group: the customer's orders in other statuses (information only). */
    getPackingCustomerOrders: builder.query<PackingCustomerOrdersDTO, { orderNumber: string }>({
      query: ({ orderNumber }) => ({ url: "/packing/customer-orders", params: { orderNumber } }),
      transformResponse: (response: ApiResponse<PackingCustomerOrdersDTO>) => unwrap(response),
      providesTags: ["PackingList"],
    }),
    /** Push a packed order to Shopfa again now (its automatic retries are pending or gave up). */
    retryPackingSync: builder.mutation<SendPackedOrderResultDTO, { packingRecordId: string }>({
      query: ({ packingRecordId }) => ({ url: `/packing/records/${packingRecordId}/retry-sync`, method: "POST" }),
      transformResponse: (response: ApiResponse<SendPackedOrderResultDTO>) => unwrap(response),
      invalidatesTags: ["PackingList", { type: "PackingHistoryList", id: "LIST" }],
    }),
    /** Status changes this system made to an order plus its packing passes (pictures, Shopfa sync state). */
    getOrderHistory: builder.query<OrderHistoryDTO, { orderNumber: string }>({
      query: ({ orderNumber }) => ({ url: `/order-history/${encodeURIComponent(orderNumber)}` }),
      transformResponse: (response: ApiResponse<OrderHistoryDTO>) => unwrap(response),
      providesTags: [{ type: "PackingHistoryList", id: "LIST" }],
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

export const {
  useLazyListPackingOrdersQuery,
  useSendPackedOrdersMutation,
  useListPackingHistoryQuery,
  useGetPackingCustomerOrdersQuery,
  useRetryPackingSyncMutation,
  useLazyGetOrderHistoryQuery,
} = packingApi;
