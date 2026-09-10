import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { AuthState } from "../store/authSlice";
import { logout } from "../store/authSlice";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

/** Base URL of the API server without the /api suffix, for linking to static assets like uploaded attachments. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const { auth } = getState() as { auth: AuthState };
    if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);
    return headers;
  },
});

/**
 * Wraps fetchBaseQuery so an expired/invalid token (401 from the API) logs
 * the user out everywhere at once, instead of leaving stale credentials in
 * the store while every subsequent request keeps failing silently.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(logout());
  }
  return result;
};

/**
 * Single RTK Query base slice. Feature modules (features/complaints/api,
 * features/customers/api, features/users/api) inject their own endpoints
 * into this via apiSlice.injectEndpoints, keeping one reducer/middleware
 * for the whole app while letting each feature own its endpoint
 * definitions -- this is what lets future modules (packing, purchasing,
 * inventory, reporting) add endpoints without touching this file.
 */
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Case",
    "CaseList",
    "CaseEvents",
    "Attachments",
    "User",
    "Settings",
    "ImportedOrder",
    "ImportedOrderList",
    "SystemLogList",
    "UserActivityLogList",
    "ShopfaTransactionLogList",
    "LogSizes",
  ],
  endpoints: () => ({}),
});
