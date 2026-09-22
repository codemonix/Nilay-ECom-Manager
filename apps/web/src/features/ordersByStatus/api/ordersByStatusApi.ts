import type { ApiResponse, OrdersByStatusRangeDays, OrdersByStatusResultDTO } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface ListOrdersByStatusArgs {
  statusCodes: number[];
  days: OrdersByStatusRangeDays;
}

export const ordersByStatusApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Live Shopfa orders in the chosen statuses within the last `days` days -- see OrdersByStatusResultDTO. */
    listOrdersByStatus: builder.query<OrdersByStatusResultDTO, ListOrdersByStatusArgs>({
      query: ({ statusCodes, days }) => ({
        url: "/order-status/orders",
        params: { statusCodes: statusCodes.join(","), days },
      }),
      transformResponse: (response: ApiResponse<OrdersByStatusResultDTO>) => unwrap(response),
    }),
  }),
});

export const { useLazyListOrdersByStatusQuery } = ordersByStatusApi;
