import { describe, expect, it, vi } from "vitest";
import type { ShopfaShortageReportOrder } from "../src/integrations/shopfa/shopfaTypes";

const listOrdersByStatusForShortageReport = vi.fn<() => Promise<ShopfaShortageReportOrder[]>>();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({ listOrdersByStatusForShortageReport }),
}));

const { buildShortageReport } = await import("../src/services/reportingService");

function order(overrides: Partial<ShopfaShortageReportOrder>): ShopfaShortageReportOrder {
  return {
    externalOrderId: "1",
    orderNumber: "1000000001",
    note: "",
    paymentDate: null,
    createdDate: null,
    items: [
      { productId: "AAA", variantId: null, title: "Item A", imageUrl: null, quantity: 1 },
      { productId: "BBB", variantId: null, title: "Item B", imageUrl: null, quantity: 2 },
    ],
    ...overrides,
  };
}

describe("buildShortageReport", () => {
  it("counts the whole order as short when the note has no shortage signal at all", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([order({ note: "" })]);
    const result = await buildShortageReport([8], 30);
    expect(result.wholeOrderShortageOrderCount).toBe(1);
    expect(result.items.map((i) => i.productId).sort()).toEqual(["AAA", "BBB"]);
    expect(result.unresolvedNotes).toEqual([]);
  });

  it("resolves an old-style manual note ('مورد N') by alphabetically-sorted row number", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([order({ note: "کمبود مورد 2" })]);
    const result = await buildShortageReport([8], 30);
    // "Item A" < "Item B" alphabetically, so row 2 is "Item B".
    expect(result.wholeOrderShortageOrderCount).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.productId).toBe("BBB");
  });

  it("resolves a new system-generated Order Precheck marker by exact product code, not row number", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([
      order({ note: "[پیش‌بررسی سفارش - کدهای ناموجود: AAA]\nیادداشت دستی قبلی" }),
    ]);
    const result = await buildShortageReport([8], 30);
    expect(result.wholeOrderShortageOrderCount).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.productId).toBe("AAA");
    expect(result.unresolvedNotes).toEqual([]);
  });

  it("does not misread a precheck marker as a whole-order shortage (regression: the marker text itself doesn't contain 'مورد'/'موارد')", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([
      order({ note: "[پیش‌بررسی سفارش - کدهای ناموجود: BBB]" }),
    ]);
    const result = await buildShortageReport([8], 30);
    expect(result.wholeOrderShortageOrderCount).toBe(0);
    expect(result.items.map((i) => i.productId)).toEqual(["BBB"]);
  });

  it("flags a precheck marker whose codes match no item on the order as unresolved, for manual review", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([
      order({ note: "[پیش‌بررسی سفارش - کدهای ناموجود: ZZZ]" }),
    ]);
    const result = await buildShortageReport([8], 30);
    expect(result.items).toEqual([]);
    expect(result.wholeOrderShortageOrderCount).toBe(0);
    expect(result.unresolvedNotes).toHaveLength(1);
  });

  it("skips an order entirely when its precheck marker explicitly lists no unavailable codes", async () => {
    listOrdersByStatusForShortageReport.mockResolvedValueOnce([
      order({ note: "[پیش‌بررسی سفارش - کدهای ناموجود: ]" }),
    ]);
    const result = await buildShortageReport([8], 30);
    expect(result.items).toEqual([]);
    expect(result.wholeOrderShortageOrderCount).toBe(0);
    expect(result.unresolvedNotes).toEqual([]);
    expect(result.totalOrdersScanned).toBe(1);
  });
});
