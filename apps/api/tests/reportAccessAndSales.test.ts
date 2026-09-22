import { describe, expect, it, vi } from "vitest";
import { MenuKey, ReportKey, StaffRole, hasReportAccess, hasReportsMenuAccess } from "@complaint-system/shared";
import type {
  ShopfaCategory,
  ShopfaCustomerReportOrder,
  ShopfaItemSalesEntry,
} from "../src/integrations/shopfa/shopfaTypes";
import { categoryTrendsQuerySchema, customerReportQuerySchema, itemSalesQuerySchema } from "../src/validators/reportingValidators";

const listOrdersForCustomerReport = vi.fn();
const listSoldItemsForReport = vi.fn();
const listShopCategories = vi.fn();
const listProductIdsInCategory = vi.fn();
const getProductByCode = vi.fn();
const listSoldItemsByDay = vi.fn();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({
    listOrdersForCustomerReport,
    listSoldItemsForReport,
    listSoldItemsByDay,
    listShopCategories,
    listProductIdsInCategory,
    getProductByCode,
  }),
}));

const { assignSeriesColorSlots, buildCategoryTrends, buildCustomerReport, buildItemSalesReport, mapCategoriesToSeries, normalizeCustomerQuery } = await import(
  "../src/services/reportingService"
);

describe("report permissions", () => {
  const staff = (permissions: string[]) => ({ role: StaffRole.MANAGER, permissions });

  it("lets admins open every report", () => {
    expect(hasReportAccess({ role: StaffRole.ADMIN, permissions: [] }, ReportKey.CUSTOMER)).toBe(true);
  });

  it("grants only the individually assigned reports", () => {
    const user = staff([ReportKey.CUSTOMER]);
    expect(hasReportAccess(user, ReportKey.CUSTOMER)).toBe(true);
    expect(hasReportAccess(user, ReportKey.SHORTAGE)).toBe(false);
    expect(hasReportAccess(user, ReportKey.ITEM_SALES)).toBe(false);
    expect(hasReportsMenuAccess(user)).toBe(true);
  });

  it("keeps the legacy all-reports grant working until specific reports are assigned", () => {
    expect(hasReportAccess(staff([MenuKey.REPORTING]), ReportKey.SHORTAGE)).toBe(true);
    expect(hasReportAccess(staff([MenuKey.REPORTING, ReportKey.CUSTOMER]), ReportKey.SHORTAGE)).toBe(false);
  });

  it("hides the Reports menu from users with no report access", () => {
    expect(hasReportsMenuAccess(staff([MenuKey.CASES]))).toBe(false);
  });
});

describe("normalizeCustomerQuery", () => {
  it("folds Persian digits and +98 prefixes into the local mobile format", () => {
    expect(normalizeCustomerQuery("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(normalizeCustomerQuery("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeCustomerQuery("9121234567")).toBe("09121234567");
  });

  it("leaves names alone apart from trimming", () => {
    expect(normalizeCustomerQuery("  سعید منفرد ")).toBe("سعید منفرد");
  });
});

describe("report query validation", () => {
  it("rejects reversed and over-long periods", () => {
    expect(customerReportQuerySchema.safeParse({ query: "abc", from: "2026-09-10", to: "2026-09-01" }).success).toBe(false);
    expect(customerReportQuerySchema.safeParse({ query: "abc", from: "2024-01-01", to: "2026-01-01" }).success).toBe(false);
    expect(customerReportQuerySchema.safeParse({ query: "abc", from: "2026-08-01", to: "2026-09-01" }).success).toBe(true);
  });

  it("requires exactly one of productId or categoryId", () => {
    const window = { from: "2026-08-01", to: "2026-09-01" };
    expect(itemSalesQuerySchema.safeParse(window).success).toBe(false);
    expect(itemSalesQuerySchema.safeParse({ ...window, productId: "1", categoryId: "2" }).success).toBe(false);
    expect(itemSalesQuerySchema.safeParse({ ...window, categoryId: "2" }).success).toBe(true);
  });
});

function customerOrder(overrides: Partial<ShopfaCustomerReportOrder>): ShopfaCustomerReportOrder {
  return {
    orderNumber: "1",
    statusTitle: "ارسال شده",
    buyerName: "Sara Test",
    mobile: "09120000000",
    orderDate: new Date("2026-09-01T10:00:00Z"),
    paymentDate: null,
    totalAmount: 1000,
    items: [{ productId: "P1", title: "Ring", quantity: 2, unitPrice: 500, amount: 1000 }],
    ...overrides,
  };
}

describe("buildCustomerReport", () => {
  it("groups by mobile and counts only sold-status orders toward the totals", async () => {
    listOrdersForCustomerReport.mockResolvedValueOnce({
      truncated: false,
      orders: [
        customerOrder({ orderNumber: "1" }),
        customerOrder({ orderNumber: "2", statusTitle: "کنسل شده", totalAmount: 9999 }),
        customerOrder({ orderNumber: "3", buyerName: "Other", mobile: "09129999999", totalAmount: 50 }),
      ],
    });
    const result = await buildCustomerReport("0912", "2026-08-01", "2026-09-20");
    expect(result.customers).toHaveLength(2);
    const sara = result.customers[0];
    expect(sara.mobile).toBe("09120000000");
    expect(sara.orderCount).toBe(2);
    expect(sara.soldOrderCount).toBe(1);
    expect(sara.totalSpent).toBe(1000);
    expect(sara.soldItemCount).toBe(2);
    expect(sara.orders.find((o) => o.orderNumber === "2")?.counted).toBe(false);
  });

  it("anchors the window to Iran time", async () => {
    listOrdersForCustomerReport.mockResolvedValueOnce({ truncated: false, orders: [] });
    await buildCustomerReport("abc", "2026-09-01", "2026-09-02");
    const range = listOrdersForCustomerReport.mock.calls.at(-1)?.[1];
    expect(range.from.toISOString()).toBe("2026-08-31T20:30:00.000Z");
    expect(range.to.toISOString()).toBe("2026-09-02T20:29:59.000Z");
  });
});

describe("buildItemSalesReport", () => {
  const categories: ShopfaCategory[] = [
    { id: "10", title: "Jewelry", parentId: "0", order: 1 },
    { id: "11", title: "Earrings", parentId: "10", order: 2 },
    { id: "12", title: "Studs", parentId: "11", order: 3 },
    { id: "20", title: "Rings", parentId: "10", order: 4 },
  ];
  const sold: ShopfaItemSalesEntry[] = [
    { productId: "A", title: "Hoop", imageUrl: null, quantity: 3, revenue: 300, orderCount: 3 },
    { productId: "B", title: "Stud", imageUrl: null, quantity: 5, revenue: 500, orderCount: 4 },
    { productId: "C", title: "Ring", imageUrl: null, quantity: 9, revenue: 900, orderCount: 9 },
  ];

  it("totals every product in a category and its sub-categories, excluding other categories", async () => {
    listSoldItemsForReport.mockResolvedValueOnce(sold);
    listShopCategories.mockResolvedValueOnce(categories);
    listProductIdsInCategory.mockImplementation(async (id: string) => ({ "11": ["A"], "12": ["B"], "20": ["C"] })[id] ?? []);
    const result = await buildItemSalesReport({ categoryId: "11" }, "2026-08-01", "2026-09-01");
    expect(result.scope).toBe("category");
    expect(result.categoryCount).toBe(1);
    expect(result.totalQuantity).toBe(8);
    expect(result.totalRevenue).toBe(800);
    expect(result.productsSold).toBe(2);
    expect(result.rows.map((r) => r.productId)).toEqual(["B", "A"]);
    expect(result.orderCount).toBeNull();
  });

  it("returns a zero row with the product title when a product had no sales", async () => {
    listSoldItemsForReport.mockResolvedValueOnce(sold);
    getProductByCode.mockResolvedValueOnce({ title: "Unsold Necklace", imageUrl: null });
    const result = await buildItemSalesReport({ productId: "ZZZ" }, "2026-08-01", "2026-09-01");
    expect(result.label).toBe("Unsold Necklace");
    expect(result.totalQuantity).toBe(0);
    expect(result.orderCount).toBe(0);
  });
});

describe("category trends", () => {
  const categories: ShopfaCategory[] = [
    { id: "1", title: "Root", parentId: "0", order: 1 },
    { id: "2", title: "Earrings", parentId: "1", order: 2 },
    { id: "3", title: "Studs", parentId: "2", order: 3 },
    { id: "9", title: "Brands", parentId: "0", order: 19 },
  ];

  it("splits a top-level category into its children and rolls deeper levels up", () => {
    const map = mapCategoriesToSeries(categories);
    expect(map.get("3")).toBe("2");
    expect(map.get("2")).toBe("2");
    expect(map.get("1")).toBe("1");
    expect(map.get("9")).toBe("9");
  });

  it("buckets sales by day, assigns products to their most specific category and folds unknown products into other", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T09:00:00Z"));
    try {
      listShopCategories.mockResolvedValueOnce(categories);
      // The parent's list includes descendants' products (confirmed live), so "S" is listed under 1, 2 and 3.
      listProductIdsInCategory.mockImplementation(async (id: string) => ({ "1": ["S", "R"], "2": ["S"], "3": ["S"] })[id] ?? []);
      const row = (productId: string, day: string, quantity: number) => ({
        productId, day, title: productId, imageUrl: null, quantity, revenue: quantity * 100, orderCount: 1,
      });
      listSoldItemsByDay.mockResolvedValueOnce([
        row("S", "2026-09-20", 2),
        row("S", "2026-09-19", 1),
        row("R", "2026-09-20", 4),
        row("X", "2026-08-23", 7),
      ]);
      const result = await buildCategoryTrends(1);
      expect(result.buckets).toHaveLength(10);
      expect(result.buckets[9]).toEqual({ startDate: "2026-09-18", endDate: "2026-09-20" });
      expect(result.buckets[0]?.startDate).toBe("2026-08-22");
      const byId = Object.fromEntries(result.series.map((s) => [s.categoryId, s]));
      expect(byId["2"]?.quantity[9]).toBe(3);
      // "R" is only listed on the split root, which has no color slot of its own -- it folds into "other".
      expect(byId["other"]?.quantity[9]).toBe(4);
      expect(byId["other"]?.quantity[0]).toBe(7);
      expect(byId["2"]?.colorSlot).toBe(0);
      expect(byId["other"]?.colorSlot).toBeNull();
      expect(result.series.at(-1)?.categoryId).toBe("other");
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers day steps that split each window evenly into 2-36 columns", async () => {
    expect(categoryTrendsQuerySchema.safeParse({ months: "12", stepDays: "15" }).success).toBe(true);
    expect(categoryTrendsQuerySchema.safeParse({ months: "12", stepDays: "7" }).success).toBe(false);
    expect(categoryTrendsQuerySchema.safeParse({ months: "1", stepDays: "1" }).success).toBe(true);
    expect(categoryTrendsQuerySchema.safeParse({ months: "3", stepDays: "10" }).success).toBe(true);
    // 1-day steps over 90 days would be 90 columns -- not offered.
    expect(categoryTrendsQuerySchema.safeParse({ months: "3", stepDays: "1" }).success).toBe(false);
    expect(categoryTrendsQuerySchema.safeParse({ months: "1", stepDays: "7" }).success).toBe(false);
    expect(categoryTrendsQuerySchema.safeParse({ months: "3" }).success).toBe(true);

    listShopCategories.mockResolvedValueOnce([]);
    listSoldItemsByDay.mockResolvedValueOnce([]);
    const result = await buildCategoryTrends(12, 10);
    expect(result.stepDays).toBe(10);
    expect(result.buckets).toHaveLength(36);
    listShopCategories.mockResolvedValueOnce([]);
    listSoldItemsByDay.mockResolvedValueOnce([]);
    expect((await buildCategoryTrends(12)).buckets).toHaveLength(12);
  });

  it("keeps a category's color slot fixed by store order, whatever sold", () => {
    const many: ShopfaCategory[] = [{ id: "r", title: "Root", parentId: "0", order: 1 }];
    for (let i = 0; i < 10; i += 1) many.push({ id: `c${i}`, title: `Cat ${i}`, parentId: "r", order: 10 - i });
    const slots = assignSeriesColorSlots(many);
    // Lowest `order` first; only the first 8 get a hue, the last two fold into "other".
    expect(slots.get("c9")).toBe(0);
    expect(slots.get("c2")).toBe(7);
    expect(slots.has("c1")).toBe(false);
    expect(slots.has("c0")).toBe(false);
    expect(slots.has("r")).toBe(false);
  });
});
