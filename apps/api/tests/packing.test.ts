import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";

const listOrdersByStatusForPacking = vi.fn();
const updateOrderStatus = vi.fn();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({ listOrdersByStatusForPacking, updateOrderStatus }),
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

  it("sends an order without a photo, moves it to shipped, and records local history with a null photoUrl", async () => {
    updateOrderStatus.mockResolvedValueOnce({ orderNumber: "1000000002", statusCode: 5, statusTitle: "ارسال شده" });
    const { authHeader, user } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .post("/api/packing/orders/1000000002/send")
      .set("Authorization", authHeader)
      .field("externalOrderId", "2")
      .field("buyerName", "Sara Karimi")
      .field("items", JSON.stringify([{ productCode: "BBB", title: "Item B", quantity: 1 }]));

    expect(res.status).toBe(200);
    expect(res.body.data.statusCode).toBe(5);
    expect(res.body.data.photoUrl).toBeNull();
    expect(updateOrderStatus).toHaveBeenCalledWith("1000000002", 5);

    const historyRes = await request(app)
      .get("/api/packing/history")
      .query({ search: "1000000002" })
      .set("Authorization", authHeader);
    expect(historyRes.status).toBe(200);
    const record = historyRes.body.data[0];
    expect(record).toBeTruthy();
    expect(record.photoUrl).toBeNull();
    expect(record.sentByName).toBe(user.name);
    expect(record.buyerName).toBe("Sara Karimi");
    expect(record.items).toEqual([{ productCode: "BBB", title: "Item B", quantity: 1 }]);
  });

  it("attaches a confirmation photo when one is provided, both to the response and to history", async () => {
    updateOrderStatus.mockResolvedValueOnce({ orderNumber: "1000000003", statusCode: 5, statusTitle: "ارسال شده" });
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await request(app)
      .post("/api/packing/orders/1000000003/send")
      .set("Authorization", authHeader)
      .field("externalOrderId", "3")
      .field("items", JSON.stringify([{ productCode: "CCC", title: "Item C", quantity: 1 }]))
      .attach("photo", Buffer.from("fake-image-bytes"), { filename: "package.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.data.photoUrl).toMatch(/^\/uploads\//);

    const historyRes = await request(app)
      .get("/api/packing/history")
      .query({ search: "1000000003" })
      .set("Authorization", authHeader);
    expect(historyRes.body.data[0].photoUrl).toBe(res.body.data.photoUrl);
  });

  it("returns 404 when the order can't be found on Shopfa", async () => {
    updateOrderStatus.mockResolvedValueOnce(null);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .post("/api/packing/orders/nonexistent/send")
      .set("Authorization", authHeader)
      .field("externalOrderId", "x")
      .field("items", JSON.stringify([{ productCode: "X", title: "X", quantity: 1 }]));
    expect(res.status).toBe(404);
  });

  it("rejects sending with an empty items snapshot", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .post("/api/packing/orders/1000000004/send")
      .set("Authorization", authHeader)
      .field("externalOrderId", "4")
      .field("items", JSON.stringify([]));
    expect(res.status).toBe(422);
  });
});
