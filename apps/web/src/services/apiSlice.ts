import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { DevUserState } from "../store/devUserSlice";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

/** Base URL of the API server without the /api suffix, for linking to static assets like uploaded attachments. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

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
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers, { getState }) => {
      const { devUser } = getState() as { devUser: DevUserState };
      if (devUser.selectedUserId) headers.set("x-user-id", devUser.selectedUserId);
      return headers;
    },
  }),
  tagTypes: ["Case", "CaseList", "CaseEvents", "Attachments", "User"],
  endpoints: () => ({}),
});
