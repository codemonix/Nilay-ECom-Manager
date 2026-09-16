import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { PackingListResultDTO, PackingRangeDays, SendPackedOrderResultDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ListPackingOrdersArgs {
  days: PackingRangeDays;
}

export const packingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Every order currently "ارسال شده به سرویس پستی" created within the last `days` days -- see PackingListResultDTO. */
    listPackingOrders: builder.query<PackingListResultDTO, ListPackingOrdersArgs>({
      query: ({ days }) => ({ url: "/packing/orders", params: { days } }),
      transformResponse: (response: ApiResponse<PackingListResultDTO>) => unwrap(response),
      providesTags: ["PackingList"],
    }),
    sendPackedOrder: builder.mutation<SendPackedOrderResultDTO, { orderNumber: string }>({
      query: ({ orderNumber }) => ({
        url: `/packing/orders/${orderNumber}/send`,
        method: "POST",
      }),
      transformResponse: (response: ApiResponse<SendPackedOrderResultDTO>) => unwrap(response),
      invalidatesTags: ["PackingList"],
    }),
  }),
});

export const { useLazyListPackingOrdersQuery, useSendPackedOrderMutation } = packingApi;
