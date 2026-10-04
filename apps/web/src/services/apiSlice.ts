import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { ApiResponse, AuthResponseDTO } from "@complaint-system/shared";
import type { AuthState } from "../store/authSlice";
import { logout, setCredentials } from "../store/authSlice";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

/** Base URL of the API server without the /api suffix, for linking to static assets like uploaded attachments. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  // Lets the browser store/send the httpOnly refresh-token cookie (scoped
  // to /api/auth) -- the web app and API are on different ports in dev.
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const { auth } = getState() as { auth: AuthState };
    if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);
    return headers;
  },
});

/** Endpoints whose 401 means "bad credentials", not "access token expired" -- never retried via refresh. */
const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

function requestPath(args: string | FetchArgs): string {
  return typeof args === "string" ? args : args.url;
}

/**
 * One refresh at a time per tab: when several requests 401 together they
 * all await the same /auth/refresh call instead of each rotating the
 * refresh token. Uses plain fetch so no (expired) Bearer header is sent.
 */
let refreshInFlight: Promise<AuthResponseDTO | null> | null = null;

function refreshSession(): Promise<AuthResponseDTO | null> {
  refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = (await response.json()) as ApiResponse<AuthResponseDTO>;
      return body.success ? body.data : null;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Revokes the refresh token server-side (and clears its cookie) before
 * dropping local credentials. Local logout happens even if the call fails.
 */
export async function logoutSession(dispatch: (action: ReturnType<typeof logout>) => unknown): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    // Offline or API down -- the refresh token still expires on its own.
  }
  dispatch(logout());
}

/**
 * Wraps fetchBaseQuery so a 401 (expired/invalid access token) first tries
 * to mint a new access token from the refresh-token cookie and replays the
 * request once. Only if that fails is the user logged out everywhere at
 * once, instead of leaving stale credentials in the store while every
 * subsequent request keeps failing silently.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401 || NO_REFRESH_PATHS.includes(requestPath(args))) return result;

  const session = await refreshSession();
  if (!session) {
    api.dispatch(logout());
    return result;
  }
  api.dispatch(setCredentials(session));
  result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) api.dispatch(logout());
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
    "SecurityEventList",
    "UserActivityLogList",
    "ShopfaTransactionLogList",
    "LogSizes",
    "Package",
    "PackageList",
    "PackageEvents",
    "PackageAttachments",
    "PurchasingOverview",
    "OrderPrecheckList",
    "PackingList",
    "PackingHistoryList",
  ],
  endpoints: () => ({}),
});
