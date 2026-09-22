/**
 * Wire shapes for the real Shopfa REST API, verified directly against the
 * live Nilay Jewelry store (see docs/architecture.md#shopfa-integration).
 * These are intentionally kept separate from the `ShopfaRaw*` types in
 * ./shopfaTypes.ts, which describe the simplified shape used by
 * MockShopfaClient/mockData.ts -- the two never need to agree on a wire
 * format, only on the `ShopfaClient` interface both implement.
 *
 * Notable API-wide conventions, confirmed live (several differ from the
 * OpenAPI export's descriptions, which turned out to be incomplete/wrong
 * for this store):
 * - Every endpoint is called with HTTP POST, but Shopfa reads its filter
 *   parameters (including auth) from the query string, not the JSON body
 *   -- some endpoints (e.g. /api/shop/orders/details's `id`) silently
 *   ignore a body value and fail with a "required field" error unless the
 *   same value is also sent as a query param. Sending every parameter as a
 *   query param (see shopfaClient.ts) works uniformly across endpoints.
 * - Auth is a `private_key` query parameter (the token from
 *   /api/user/signin), NOT an Authorization header -- a header-based token
 *   is silently ignored and every authenticated endpoint fails with
 *   "دسترسی فقط برای اعضا ممکن است" (access only possible for members).
 * - Every response can carry the common envelope fields below
 *   (`successful`/`error`/`error_code`/`time`); note `successful` stays
 *   `true` even on a 4xx error response with a populated `error` field, so
 *   callers must check the HTTP status and `error`, not just `successful`.
 * - /api/shop/orders and /api/shop/orders/details (which is the same
 *   underlying list, filtered by `id`) wrap rows under `baskets`, not
 *   `items`. /api/user/users wraps rows under `items`.
 * - Money amounts and unix timestamps are transmitted as numbers (not
 *   strings, despite the OpenAPI export's description).
 * - A basket/order's `id` is only its internal row id, used to look it up
 *   again via /api/shop/orders/details -- the human-facing order number
 *   (what a customer or staff member would call "the order number") is the
 *   separate `session` field. Confirmed live: searching for a specific
 *   customer's order by the number on their tracking page found it under
 *   `session`, not `id`.
 */
export interface ShopfaApiCommonResponse {
  successful?: boolean;
  error?: string | null;
  error_code?: number;
  time?: string | number;
}

/** POST /api/user/users -- rows under `items`. */
export interface ShopfaApiUserListResponse extends ShopfaApiCommonResponse {
  items?: ShopfaApiUser[];
  page?: number;
  limit?: number;
}

/** POST /api/shop/orders and /api/shop/orders/details -- both return this same envelope, rows under `baskets`. */
export interface ShopfaApiOrderListResponse extends ShopfaApiCommonResponse {
  baskets?: ShopfaApiOrder[];
  item_count?: number;
  current_page?: number;
  total_count?: number;
}

/** A product line inside an order (its own `items` array), per a live /api/shop/orders response. */
export interface ShopfaApiOrderItem {
  id?: string | number;
  product_id: string | number;
  variant_id?: string | number;
  title?: string;
  variant_title?: string;
  price?: string | number;
  count?: string | number;
  sum_price?: string | number;
  /** Thumbnail image URL, confirmed present on live order line items -- used by Reporting's shortage report. */
  thumb?: string | null;
}

/** One row of the `baskets` array returned by /api/shop/orders and /api/shop/orders/details. */
export interface ShopfaApiOrder {
  id: string | number;
  /** The customer-facing order number -- see the note above `id` isn't it. */
  session?: string | number;
  user_id?: string | number;
  date?: string | number; // unix seconds -- order date
  update?: string | number; // unix seconds -- last edited
  payment_date?: string | number;
  status: string | number;
  status_title?: string;
  /** Shipping method id / display title (title can be empty for some methods). Id 0 = none selected. */
  post_method?: string | number;
  post_method_title?: string;
  name?: string;
  family?: string;
  email?: string;
  mobile?: string;
  sum_price?: string | number;
  item_price?: string | number;
  items?: ShopfaApiOrderItem[];
  /**
   * The admin note ("یادداشت مدیر" in the dashboard). Only present when
   * explicitly requested via `fields=...,note` -- absent from every
   * default response, unlike every other field on this type. See
   * ShopfaClient.getOrderAdminNote for how this was confirmed live.
   */
  note?: string;
}

/**
 * POST /api/shop/product/list -- confirmed live against the real store
 * (the OpenAPI export at docs/shopfa-openapi.json has no field-level schema
 * for this endpoint, so this shape was verified by direct test calls, not
 * documentation). Two query params matter for Purchasing's Match & Register:
 * `id` filters to one exact product (what our `productCode` values -- the
 * "کد کالا" column from xlsx imports -- actually are), and `q` performs a
 * free-text search across titles, returning multiple candidates. Neither
 * filter changes the response envelope, only which rows come back in
 * `items`; a filter that matches nothing still returns HTTP 200 with
 * `items: []`, `total_count: 0`, and `error: "Not Found"` (`successful`
 * stays `true` either way -- do not branch on it here). There is no
 * separate SKU-like field in this response, only `id`. Real titles do end
 * in "*" (confirmed), same convention documented on shopfaTitleEndsWithAsterisk.
 */
export interface ShopfaApiProduct {
  id: string | number;
  page_id?: string | number;
  title: string;
  /** Thumbnail image URL. */
  thumb?: string | null;
  price?: string | number;
  old_price?: string | number;
  /** Current stock count. */
  quantity?: string | number;
  unit?: string;
  product_status?: string | number;
  variant?: boolean;
  variants?: unknown[];
}

export interface ShopfaApiProductListResponse extends ShopfaApiCommonResponse {
  item_count?: number;
  current_page?: number;
  q?: string;
  total_count?: number;
  items?: ShopfaApiProduct[];
}

/** One row of the `items` array returned by /api/user/users -- the display name field is `name`, not `username`. */
export interface ShopfaApiUser {
  id: string | number;
  name?: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  mobile?: string;
}

/** One row of `/api/system/pages` -- a site section; product categories are the ones with `module` 2102. */
export interface ShopfaApiPage {
  id: string | number;
  title: string;
  parent?: string | number;
  module?: string | number;
  order?: string | number;
}

export interface ShopfaApiPageListResponse extends ShopfaApiCommonResponse {
  items?: ShopfaApiPage[];
}
