import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";

const listOrdersByStatusForPacking = vi.fn();
const updateOrderStatus = vi.fn();
const listOrdersByStatusesForCustomerLookup = vi.fn().mockResolvedValue([]);
const countOrdersInStatus = vi.fn().mockResolvedValue(null);

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({ listOrdersByStatusForPacking, updateOrderStatus, listOrdersByStatusesForCustomerLookup, countOrdersInStatus }),
}));

const { createApp } = await import("../src/app");
const app = createApp();

describe("Packing module", () => {
  it("rejects requests from a role without the packing permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  it("lists orders in the fixed source status (13) within the requested day range", async () => {
    listOrdersByStatusForPacking.mockResolvedValueOnce([
      {
        externalOrderId: "1",
        orderNumber: "1000000001",
        buyerName: "Ali Ahmadi",
        orderDate: new Date(),
        statusCode: 13,
        statusTitle: "ارسال شده به سرویس پستی",
        items: [{ productCode: "AAA", title: "Item A", imageUrl: null, quantity: 2 }],
      },
    ]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/packing/orders").query({ days: 30 }).set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.days).toBe(30);
    expect(listOrdersByStatusForPacking).toHaveBeenCalledWith(13, expect.any(Object));
  });

  const snapshot = (orderNumber: string, buyerName = "Sara Karimi") => ({
    orderNumber,
    externalOrderId: `ext-${orderNumber}`,
    buyerName,
    items: [{ productCode: "BBB", title: "Item B", quantity: 1 }],
  });

  it("sends a whole customer group without photos: every order moves to shipped and gets a local history record with no photos", async () => {
    updateOrderStatus
      .mockResolvedValueOnce({ orderNumber: "2001", statusCode: 5, statusTitle: "ارسال شده" })
      .mockResolvedValueOnce({ orderNumber: "2002", statusCode: 5, statusTitle: "ارسال شده" });
    const { authHeader, user } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field("orders", JSON.stringify([snapshot("2001"), snapshot("2002")]));

    expect(res.status).toBe(200);
    expect(res.body.data.failed).toEqual([]);
    expect(res.body.data.sent.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["2001", "2002"]);
    expect(updateOrderStatus).toHaveBeenCalledWith("2001", 5);
    expect(updateOrderStatus).toHaveBeenCalledWith("2002", 5);

    const historyRes = await request(app).get("/api/packing/history").query({ search: "2001" }).set("Authorization", authHeader);
    const record = historyRes.body.data[0];
    expect(record.photoUrls).toEqual([]);
    expect(record.sentByName).toBe(user.name);
    expect(record.buyerName).toBe("Sara Karimi");
    expect(record.items).toEqual([{ productCode: "BBB", title: "Item B", quantity: 1 }]);
  });

  it("attaches several confirmation photos to every order in the group, in the order they were taken", async () => {
    updateOrderStatus
      .mockResolvedValueOnce({ orderNumber: "3001", statusCode: 5, statusTitle: "ارسال شده" })
      .mockResolvedValueOnce({ orderNumber: "3002", statusCode: 5, statusTitle: "ارسال شده" });
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field("orders", JSON.stringify([snapshot("3001"), snapshot("3002")]))
      .attach("photos", Buffer.from("first"), { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("photos", Buffer.from("second"), { filename: "b.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toHaveLength(2);
    for (const sent of res.body.data.sent) expect(sent.photoUrls).toHaveLength(2);

    const historyRes = await request(app).get("/api/packing/history").query({ search: "3002" }).set("Authorization", authHeader);
    expect(historyRes.body.data[0].photoUrls).toEqual(res.body.data.sent[1].photoUrls);
    expect(historyRes.body.data[0].photoUrls[0]).toMatch(/^\/uploads\//);
  });

  it("keeps going when one order in the group fails, reporting which were sent and which failed", async () => {
    updateOrderStatus
      .mockResolvedValueOnce({ orderNumber: "4001", statusCode: 5, statusTitle: "ارسال شده" })
      .mockResolvedValueOnce(null);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field("orders", JSON.stringify([snapshot("4001"), snapshot("4002")]));

    expect(res.status).toBe(200);
    expect(res.body.data.sent.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["4001"]);
    expect(res.body.data.failed).toEqual([{ orderNumber: "4002", message: "Order not found" }]);
  });

  it("rejects sending with no orders", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field("orders", JSON.stringify([]));
    expect(res.status).toBe(422);
  });

  it("groups one customer's orders together by mobile (formats normalized), falling back to name, with groups ordered by oldest payment", async () => {
    const mk = (orderNumber: string, buyerName: string | null, buyerMobile: string | null, paid: string) => ({
      externalOrderId: orderNumber,
      orderNumber,
      buyerName,
      buyerMobile,
      orderDate: new Date(paid),
      paymentDate: new Date(paid),
      statusCode: 13,
      statusTitle: "x",
      items: [{ productCode: "A", title: "A", imageUrl: null, quantity: 1 }],
    });
    listOrdersByStatusForPacking.mockResolvedValueOnce([
      mk("1", "Sara", "09121112233", "2026-09-05"),
      mk("2", "Ali", "09355556666", "2026-09-01"),
      mk("3", "Sara K", "+98 912 111 2233", "2026-09-02"),
      mk("4", "Reza", null, "2026-09-03"),
      mk("5", "reza", null, "2026-09-04"),
    ]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    // Ali's group is oldest (09-01); Sara's two orders (09-02 / 09-05) come next together; Reza's two (by name) last.
    expect(res.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["2", "3", "1", "4", "5"]);
    const [, sara1, sara2] = res.body.data.orders;
    expect(sara1.customerGroupKey).toBe(sara2.customerGroupKey);
  });

  it("returns each order's shipping method and flags the same customer's other orders in pending statuses (matched by normalized mobile, else name)", async () => {
    const mk = (orderNumber: string, buyerName: string | null, buyerMobile: string | null, shippingMethod: string | null) => ({
      externalOrderId: orderNumber, orderNumber, buyerName, buyerMobile, shippingMethod,
      orderDate: new Date("2026-09-01"), paymentDate: new Date("2026-09-01"), statusCode: 13, statusTitle: "x",
      items: [{ productCode: "A", title: "A", imageUrl: null, quantity: 1 }],
    });
    listOrdersByStatusForPacking.mockResolvedValueOnce([
      mk("1", "Sara", "09121112233", "ارسال تیپاکس"),
      mk("2", "Ali", "09355556666", null),
    ]);
    listOrdersByStatusesForCustomerLookup.mockResolvedValueOnce([
      { orderNumber: "90", buyerName: "Sara K", buyerMobile: "+98 912 111 2233", statusCode: 8, statusTitle: "پردازش انبار" },
      { orderNumber: "91", buyerName: "Other", buyerMobile: "09990000000", statusCode: 4, statusTitle: "پرداخت تائيد شده" },
    ]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    // default is ALL TIME: no window at all, so nothing in the status is hidden
    expect(listOrdersByStatusesForCustomerLookup.mock.calls.at(-1)).toEqual([[8, 9, 4], null]);
    const byNumber = Object.fromEntries(res.body.data.orders.map((o: { orderNumber: string }) => [o.orderNumber, o]));
    expect(byNumber["1"].shippingMethod).toBe("ارسال تیپاکس");
    expect(byNumber["1"].pendingOrders).toEqual([{ orderNumber: "90", statusCode: 8, statusTitle: "پردازش انبار" }]);
    expect(byNumber["2"].pendingOrders).toEqual([]);
    expect(res.body.data.pendingLookupFailed).toBe(false);
  });

  it("still loads the queue, flagging pendingLookupFailed, when the pending-orders lookup fails", async () => {
    listOrdersByStatusForPacking.mockResolvedValueOnce([
      { externalOrderId: "1", orderNumber: "1", buyerName: "A", buyerMobile: null, shippingMethod: null, orderDate: new Date(), paymentDate: null, statusCode: 13, statusTitle: "x", items: [] },
    ]);
    listOrdersByStatusesForCustomerLookup.mockRejectedValueOnce(new Error("boom"));
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.pendingLookupFailed).toBe(true);
  });

  it("loads ALL orders in the status by default (no time window), reporting the true total; a chosen window bounds both the queue and the pending-orders check", async () => {
    listOrdersByStatusForPacking.mockResolvedValue([]);
    countOrdersInStatus.mockResolvedValueOnce(154).mockResolvedValueOnce(154);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const all = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    expect(listOrdersByStatusForPacking.mock.calls.at(-1)).toEqual([13, null]);
    expect(countOrdersInStatus).toHaveBeenCalledWith(13);
    expect(all.body.data).toMatchObject({ days: 0, rangeFromISO: null, rangeToISO: null, statusTotal: 154 });

    const windowed = await request(app).get("/api/packing/orders").query({ days: 60 }).set("Authorization", authHeader);
    const range = listOrdersByStatusForPacking.mock.calls.at(-1)?.[1] as { from: Date; to: Date };
    expect(Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)).toBe(60);
    expect(listOrdersByStatusesForCustomerLookup.mock.calls.at(-1)?.[1]).toEqual(range);
    expect(windowed.body.data.rangeFromISO).toBe(range.from.toISOString());
    listOrdersByStatusForPacking.mockReset();
  });
});
