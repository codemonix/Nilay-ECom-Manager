import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

const recordTransaction = vi.fn();

vi.mock("../src/services/shopfaTransactionLogService", () => ({ record: recordTransaction }));
vi.mock("../src/config/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { HttpShopfaClient } = await import("../src/integrations/shopfa/shopfaClient");

/** Answers each Shopfa call by endpoint with HTTP 200 and the given body; counts calls per endpoint. */
function clientAnswering(bodies: Record<string, unknown>) {
  const calls: Record<string, number> = {};
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? "";
    calls[url] = (calls[url] ?? 0) + 1;
    return { data: bodies[url] ?? {}, status: 200, statusText: "OK", headers: {}, config };
  };
  const client = new HttpShopfaClient("https://shop.example.com", "test-token");
  (client as unknown as { http: { defaults: { adapter: AxiosAdapter } } }).http.defaults.adapter = adapter;
  return { client, calls };
}

const ORDER_LIST = { successful: true, baskets: [{ id: 77, session: "4792522113", note: "", status: 5, status_title: "x" }] };

describe("Shopfa errors reported inside an HTTP 200 response", () => {
  beforeEach(() => {
    recordTransaction.mockReset();
  });

  it("fails a write whose 200 body carries an error, with Shopfa's message, logged as failed and not retried", async () => {
    const { client, calls } = clientAnswering({
      "/api/shop/orders": ORDER_LIST,
      "/api/shop/orders/update": { successful: true, error: "وضعیت نامعتبر است", error_code: 4012 },
    });

    await expect(client.updateOrderNoteAndStatus("4792522113", { note: "n", statusCode: 6 })).rejects.toMatchObject({
      statusCode: 502,
      message: "Shopfa rejected the request: وضعیت نامعتبر است",
    });

    expect(calls["/api/shop/orders/update"]).toBe(1);
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/shop/orders/update",
        statusCode: 200,
        success: false,
        errorMessage: "Shopfa error in HTTP 200 response (error_code 4012): وضعیت نامعتبر است",
      }),
    );
  });

  it("treats `successful: false` without an error text as a failed write too", async () => {
    const { client } = clientAnswering({
      "/api/shop/orders": ORDER_LIST,
      "/api/shop/orders/update": { successful: false },
    });

    await expect(client.updateOrderStatus("4792522113", 6)).rejects.toMatchObject({ statusCode: 502 });
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "/api/shop/orders/update", success: false }),
    );
  });

  it("logs a read's 200-with-error as failed but still returns the response", async () => {
    const { client } = clientAnswering({ "/api/shop/orders": { successful: true, error: "limit too large", baskets: [] } });

    await expect(client.getOrderAdminNote("4792522113")).resolves.toBeNull();
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "/api/shop/orders", success: false, errorMessage: expect.stringContaining("limit too large") }),
    );
  });

  it("keeps a product lookup's documented `error: \"Not Found\"` as a successful empty result", async () => {
    const { client } = clientAnswering({
      "/api/shop/product/list": { successful: true, items: [], total_count: 0, error: "Not Found" },
    });

    await expect(client.getProductByCode("999")).resolves.toBeNull();
    expect(recordTransaction).toHaveBeenCalledWith(expect.objectContaining({ success: true, errorMessage: null }));
  });
});
