import type { ApiResponse } from "@complaint-system/shared";
import { apiSlice } from "../../../services/apiSlice";
import type {
  CategoryTrendMonths,
  CategoryTrendResultDTO,
  CustomerReportResultDTO,
  ItemSalesCategoryDTO,
  ItemSalesProductSearchResultDTO,
  ItemSalesResultDTO,
  ReportingOrderDetailsDTO,
  ShortageReportRangeDays,
  ShortageReportResultDTO,
} from "../types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) throw new Error(response.error.message);
  return response.data;
}

export interface GetShortageReportArgs {
  statusCodes: number[];
  days: ShortageReportRangeDays;
}

export interface GetCustomerReportArgs {
  query: string;
  from: string;
  to: string;
}

/** Exactly one of `productId`/`categoryId` -- see itemSalesQuerySchema. */
export interface GetItemSalesReportArgs {
  productId?: string;
  categoryId?: string;
  from: string;
  to: string;
}

export const reportingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /** Scans every order in the given Shopfa status codes, within the given time window, for a shortage signal in its admin note -- see ShortageReportResultDTO. */
    getShortageReport: builder.query<ShortageReportResultDTO, GetShortageReportArgs>({
      query: ({ statusCodes, days }) => ({
        url: "/reporting/shortage",
        params: { statusCodes: statusCodes.join(","), days },
      }),
      transformResponse: (response: ApiResponse<ShortageReportResultDTO>) => unwrap(response),
    }),
    /** Every order for customers matching a name/mobile in the period, grouped per customer -- see CustomerReportResultDTO. */
    getCustomerReport: builder.query<CustomerReportResultDTO, GetCustomerReportArgs>({
      query: (params) => ({ url: "/reporting/customer", params }),
      transformResponse: (response: ApiResponse<CustomerReportResultDTO>) => unwrap(response),
    }),
    /** Units/revenue sold of a product or a whole category in the period -- see ItemSalesResultDTO. */
    getItemSalesReport: builder.query<ItemSalesResultDTO, GetItemSalesReportArgs>({
      query: (params) => ({ url: "/reporting/item-sales", params }),
      transformResponse: (response: ApiResponse<ItemSalesResultDTO>) => unwrap(response),
    }),
    /** Units/revenue per category per time bucket ending today -- see CategoryTrendResultDTO. */
    getCategoryTrends: builder.query<CategoryTrendResultDTO, { months: CategoryTrendMonths; stepDays: number }>({
      query: (params) => ({ url: "/reporting/category-trends", params }),
      transformResponse: (response: ApiResponse<CategoryTrendResultDTO>) => unwrap(response),
    }),
    getItemSalesCategories: builder.query<ItemSalesCategoryDTO[], void>({
      query: () => "/reporting/item-sales/categories",
      transformResponse: (response: ApiResponse<ItemSalesCategoryDTO[]>) => unwrap(response),
    }),
    searchItemSalesProducts: builder.query<ItemSalesProductSearchResultDTO[], string>({
      query: (q) => ({ url: "/reporting/item-sales/products", params: { q } }),
      transformResponse: (response: ApiResponse<ItemSalesProductSearchResultDTO[]>) => unwrap(response),
    }),
    /** One live Shopfa order by its order number -- see ReportingOrderDetailsDTO. */
    getReportingOrderDetails: builder.query<ReportingOrderDetailsDTO, string>({
      query: (orderNumber) => `/reporting/orders/${encodeURIComponent(orderNumber)}`,
      transformResponse: (response: ApiResponse<ReportingOrderDetailsDTO>) => unwrap(response),
    }),
  }),
});

export const {
  useLazyGetShortageReportQuery,
  useGetReportingOrderDetailsQuery,
  useLazyGetCustomerReportQuery,
  useLazyGetItemSalesReportQuery,
  useGetCategoryTrendsQuery,
  useGetItemSalesCategoriesQuery,
  useSearchItemSalesProductsQuery,
} = reportingApi;
