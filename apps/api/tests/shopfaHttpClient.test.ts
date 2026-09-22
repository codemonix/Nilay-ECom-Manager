import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
let capturedInterceptor: ((config: any) => any) | undefined;
const create = vi.fn(() => ({
  post,
  interceptors: {
    request: {
      use: vi.fn((fn: (config: any) => any) => {
        capturedInterceptor = fn;
      }),
    },
    response: {
      use: vi.fn(),
    },
  },
}));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    default: {
      ...actual.default,
      create,
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

const { HttpShopfaClient } = await import("../src/integrations/shopfa/shopfaClient");

describe("HttpShopfaClient (real Shopfa REST API, verified against the live store)", () => {
  beforeEach(() => {
    post.mockReset();
    create.mockClear();
    capturedInterceptor = undefined;
  });

  it("creates the axios instance with the configured base URL and no static auth header", () => {
    new HttpShopfaClient("https://www.example-shop.com", "abc123token");
    expect(create).toHaveBeenCalledWith({ baseURL: "https://www.example-shop.com", timeout: 25_000 });
  });

  it("registers a request interceptor that injects `private_key` as a query param -- Shopfa reads auth from the query string, not an Authorization header (a header-based token is silently ignored)", () => {
    new HttpShopfaClient("https://www.example-shop.com", "abc123token");
    expect(capturedInterceptor).toBeTypeOf("function");
    const config = capturedInterceptor!({ params: { limit: 5 } });
    expect(config.params).toEqual({ private_key: "abc123token", limit: 5 });
  });

  it("searches customers via POST /api/user/users and maps the Shopfa user shape", async () => {
    post.mockResolvedValueOnce({
      data: {
        successful: true,
        items: [
          { id: 501, nickname: "Ali Ahmadi", mobile: "09121112233", email: "ali@example.com" },
          { id: 502, name: "user_502", first_name: "Sara", last_name: "M", mobile: "09122223344", email: null },
        ],
      },
    });

    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const results = await client.searchCustomer("Ahmadi");

    expect(post).toHaveBeenCalledWith("/api/user/users", {}, { params: { q: "Ahmadi", limit: 20 } });
    expect(results).toEqual([
      { externalCustomerId: "501", name: "Ali Ahmadi", phone: "09121112233", email: "ali@example.com" },
      { externalCustomerId: "502", name: "Sara M", phone: "09122223344", email: undefined },
    ]);
  });

  it("tolerates a bare array response (no `items` wrapper) from /api/user/users", async () => {
    post.mockResolvedValueOnce({ data: [{ id: 9, nickname: "Bare Array User" }] });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const results = await client.searchCustomer("bare");
    expect(results).toEqual([{ externalCustomerId: "9", name: "Bare Array User", phone: undefined, email: undefined }]);
  });

  it("builds a customer order summary by aggregating POST /api/shop/orders filtered by user_id (response rows are under `baskets`, not `items`)", async () => {
    post.mockResolvedValueOnce({
      data: {
        successful: true,
        baskets: [
          { id: 1001, user_id: 501, date: 1_725_000_000, status: 3, status_title: "پرداخت شده", name: "Ali", family: "Ahmadi", mobile: "0912", sum_price: 1500000 },
          { id: 1002, user_id: 501, date: 1_726_000_000, status: 6, status_title: "تحویل داده شده", name: "Ali", family: "Ahmadi", mobile: "0912", sum_price: 2500000 },
        ],
      },
    });

    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const summary = await client.getCustomerOrderSummary("501");

    expect(post).toHaveBeenCalledWith(
      "/api/shop/orders",
      {},
      { params: { user_id: "501", limit: 200, sort: "date", order: "desc" } },
    );
    expect(summary).toMatchObject({
      externalCustomerId: "501",
      name: "Ali Ahmadi",
      phone: "0912",
      ordersCount: 2,
      totalSpent: 4_000_000,
      currency: "IRR",
      averageOrderValue: 2_000_000,
    });
    expect(summary?.lastOrderDate).toBe(new Date(1_726_000_000 * 1000).toISOString());
  });

  it("returns null for a customer with no orders", async () => {
    post.mockResolvedValueOnce({ data: { successful: true, baskets: [] } });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    expect(await client.getCustomerOrderSummary("999")).toBeNull();
  });

  it("fetches order details via POST /api/shop/orders/details -- the response wraps the single order under `baskets`, same as the list endpoint", async () => {
    post.mockResolvedValueOnce({
      data: {
        successful: true,
        baskets: [
          {
            id: 4242,
            session: "9876543210",
            date: 1_725_500_000,
            status: 5,
            status_title: "ارسال شده",
            sum_price: 3200000,
            items: [{ product_id: 111, variant_id: 222, title: "Gold Necklace", variant_title: "18k", count: "2" }],
          },
        ],
      },
    });

    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const order = await client.getOrder("4242");

    expect(post).toHaveBeenCalledWith("/api/shop/orders/details", {}, { params: { id: "4242" } });
    expect(order).toEqual({
      externalOrderId: "4242",
      orderNumber: "9876543210",
      createdAt: new Date(1_725_500_000 * 1000).toISOString(),
      status: "ارسال شده",
      total: 3_200_000,
      currency: "IRR",
      items: [{ externalItemId: "222", sku: "111", title: "Gold Necklace - 18k", quantity: 2 }],
      externalCustomerId: undefined,
      customerName: undefined,
      customerPhone: undefined,
      customerEmail: undefined,
    });
  });

  it("uses the customer-facing `session` field as orderNumber, not the internal basket `id` -- confirmed live: basket id 20631784 for سارینا شریفی has order number 4758530548 (its `session`), and the two are never the same value", async () => {
    post.mockResolvedValueOnce({
      data: { baskets: [{ id: 20631784, session: "4758530548", date: 1_725_000_000, status: 5 }] },
    });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const order = await client.getOrder("20631784");
    expect(order?.externalOrderId).toBe("20631784");
    expect(order?.orderNumber).toBe("4758530548");
  });

  it("falls back to the basket id as orderNumber only when `session` is absent", async () => {
    post.mockResolvedValueOnce({ data: { baskets: [{ id: 4242, date: 1_725_000_000, status: 5 }] } });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const order = await client.getOrder("4242");
    expect(order?.orderNumber).toBe("4242");
  });

  it("falls back to product_id for a line item when variant_id is Shopfa's `0` (no-variant) sentinel, and treats user_id 0 as a guest order (no externalCustomerId)", async () => {
    post.mockResolvedValueOnce({
      data: {
        baskets: [
          {
            id: 555,
            user_id: 0,
            date: 1_725_000_000,
            status: 3,
            sum_price: 100000,
            items: [{ product_id: 111, variant_id: 0, title: "Widget", count: "1" }],
          },
        ],
      },
    });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const order = await client.getOrder("555");
    expect(order?.externalCustomerId).toBeUndefined();
    expect(order?.items[0]).toMatchObject({ externalItemId: "111", sku: "111" });
  });

  it("returns null when Shopfa reports an order as not found -- confirmed live to be an HTTP 400 with a Shopfa-specific error, not a distinct 404", async () => {
    const err = Object.assign(new Error("Request failed with status code 400"), {
      isAxiosError: true,
      response: { status: 400, data: { successful: true, error: "سبد وجود ندارد", error_code: 2121 } },
    });
    post.mockRejectedValueOnce(err);
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    expect(await client.getOrder("does-not-exist")).toBeNull();
  });

  it("still returns null on a plain 404, and on any other 4xx, without throwing", async () => {
    const err = Object.assign(new Error("Request failed"), { isAxiosError: true, response: { status: 404 } });
    post.mockRejectedValueOnce(err);
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    expect(await client.getOrder("missing")).toBeNull();
  });

  it("does NOT retry a legitimate 'not found' 4xx -- it's a real answer, not a communication failure, so a second call would just waste a round trip", async () => {
    const err = Object.assign(new Error("Request failed"), { isAxiosError: true, response: { status: 400 } });
    post.mockRejectedValueOnce(err);
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    expect(await client.getOrder("missing")).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("wraps a 5xx or network-level failure in a 502 ApiError instead of returning null, after retrying once", async () => {
    const err = Object.assign(new Error("Internal Server Error"), { isAxiosError: true, response: { status: 500 } });
    post.mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    await expect(client.getOrder("x")).rejects.toMatchObject({ statusCode: 502 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("retries a 5xx once and succeeds instead of failing outright, when the retry gets a good response", async () => {
    const err = Object.assign(new Error("Internal Server Error"), { isAxiosError: true, response: { status: 500 } });
    post.mockRejectedValueOnce(err).mockResolvedValueOnce({
      data: { baskets: [{ id: 4242, session: "9876543210", date: 1_725_500_000, status: 5 }] },
    });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const order = await client.getOrder("4242");
    expect(order?.orderNumber).toBe("9876543210");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("wraps unexpected failures in a 502 ApiError after retrying once", async () => {
    post.mockRejectedValueOnce(new Error("ECONNRESET")).mockRejectedValueOnce(new Error("ECONNRESET"));
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    await expect(client.searchOrders("x")).rejects.toMatchObject({ statusCode: 502 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("retries once and succeeds instead of failing outright, when the retry gets a good response (the general postWithRetry path, not getOrder's special one)", async () => {
    post
      .mockRejectedValueOnce(new Error("timeout of 25000ms exceeded"))
      .mockResolvedValueOnce({ data: { successful: true, baskets: [{ id: 77, date: 1_725_000_000, status: 1 }] } });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const results = await client.searchOrders("x");
    expect(results).toHaveLength(1);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("searches orders via POST /api/shop/orders with a `search` filter", async () => {
    post.mockResolvedValueOnce({
      data: { successful: true, baskets: [{ id: 77, date: 1_725_000_000, status: 1, sum_price: 100000 }] },
    });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const results = await client.searchOrders("SF-2026");
    expect(post).toHaveBeenCalledWith("/api/shop/orders", {}, { params: { search: "SF-2026", limit: 20 } });
    expect(results).toHaveLength(1);
    expect(results[0]?.externalOrderId).toBe("77");
  });

  it("fills in a shipping method name from Shopfa's method list when the order has only the method id (e.g. 4514), and caches that list", async () => {
    const order = (id: number, title?: string) => ({
      id, session: String(id), date: 1_725_000_000, status: 13, status_title: "x", mobile: "0912",
      post_method: 4514, ...(title !== undefined ? { post_method_title: title } : {}),
    });
    post
      .mockResolvedValueOnce({ data: { baskets: [order(1, ""), order(2, "ارسال تیپاکس")] } })
      .mockResolvedValueOnce({ data: { title: { "0": "- انتخاب", "4514": "ارسال با تیپاکس" } } })
      .mockResolvedValueOnce({ data: { baskets: [order(3, "")] } });
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const window = { from: new Date(0), to: new Date() };

    const first = await client.listOrdersByStatusForPacking(13, window);
    expect(first.map((o) => o.shippingMethod)).toEqual(["ارسال با تیپاکس", "ارسال تیپاکس"]);
    expect(post).toHaveBeenCalledWith("/api/shop/cart/shipping/list/get_method", {}, undefined);

    const second = await client.listOrdersByStatusForPacking(13, window);
    expect(second[0]?.shippingMethod).toBe("ارسال با تیپاکس");
    expect(post).toHaveBeenCalledTimes(3); // no second method-list call: cached
  });

  it("falls back to the method id only when the method list can't be fetched, without failing the queue", async () => {
    post
      .mockResolvedValueOnce({
        data: { baskets: [{ id: 1, session: "1", date: 1_725_000_000, status: 13, post_method: 4514, post_method_title: "" }] },
      })
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));
    const client = new HttpShopfaClient("https://www.example-shop.com", "token");
    const orders = await client.listOrdersByStatusForPacking(13, { from: new Date(0), to: new Date() });
    expect(orders[0]?.shippingMethod).toBe("#4514");
  });
});
