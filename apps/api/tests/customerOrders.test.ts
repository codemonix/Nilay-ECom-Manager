import { describe, expect, it } from "vitest";
import * as customerService from "../src/services/customerService";
import { MOCK_ORDERS } from "../src/integrations/shopfa/mockData";

// SHOPFA_MOCK=true (set in tests/setup.ts) routes these through MockShopfaClient,
// so this exercises the same read-only path case creation uses to look up a
// real order without touching Shopfa's mutating endpoints.
describe("customerService order lookup (case-creation support)", () => {
  it("finds an order by id/order-number via searchOrders", async () => {
    const target = MOCK_ORDERS[0]!;
    const results = await customerService.searchOrders(target.order_number);
    expect(results.some((o) => o.externalOrderId === target.id)).toBe(true);
  });

  it("returns an empty list for a query with no matches", async () => {
    const results = await customerService.searchOrders("no-such-order-xyz");
    expect(results).toEqual([]);
  });

  it("carries the order's customer identity so a match can be linked without a separate lookup", async () => {
    const target = MOCK_ORDERS[0]!;
    const order = await customerService.getOrderSummary(target.id);
    expect(order.externalCustomerId).toBe(target.customer_id);
  });

  it("throws a 404 ApiError for an unknown order id", async () => {
    await expect(customerService.getOrderSummary("does-not-exist")).rejects.toMatchObject({ statusCode: 404 });
  });
});
