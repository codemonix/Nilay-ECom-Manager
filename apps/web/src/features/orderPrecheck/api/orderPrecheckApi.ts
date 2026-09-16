import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type { OrderPrecheckListResultDTO, SaveOrderPrecheckItemInput, SaveOrderPrecheckResultDTO } from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ListOrderPrecheckArgs {
  statusCodes: number[];
}

export interface SaveOrderPrecheckArgs {
  orderNumber: string;
  items: SaveOrderPrecheckItemInput[];
}

export const orderPrecheckApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Every order currently in the given Shopfa status codes, ready for one-at-a-time review -- see OrderPrecheckListResultDTO. */
    listOrderPrecheckOrders: builder.query<OrderPrecheckListResultDTO, ListOrderPrecheckArgs>({
      query: ({ statusCodes }) => ({
        url: "/order-precheck/orders",
        params: { statusCodes: statusCodes.join(",") },
      }),
      transformResponse: (response: ApiResponse<OrderPrecheckListResultDTO>) => unwrap(response),
      providesTags: ["OrderPrecheckList"],
    }),
    saveOrderPrecheck: builder.mutation<SaveOrderPrecheckResultDTO, SaveOrderPrecheckArgs>({
      query: ({ orderNumber, items }) => ({
        url: `/order-precheck/orders/${orderNumber}/save`,
        method: "POST",
        body: { items },
      }),
      transformResponse: (response: ApiResponse<SaveOrderPrecheckResultDTO>) => unwrap(response),
      invalidatesTags: ["OrderPrecheckList"],
    }),
  }),
});

export const { useLazyListOrderPrecheckOrdersQuery, useSaveOrderPrecheckMutation } = orderPrecheckApi;
