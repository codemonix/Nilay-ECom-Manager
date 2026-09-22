import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { AttachmentSubjectType, StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";
import { packingRecordRepository } from "../src/repositories/packingRecordRepository";
import { attachmentRepository } from "../src/repositories/attachmentRepository";

const listOrdersByStatuses = vi.fn();
const countOrdersInStatus = vi.fn();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({ listOrdersByStatuses, countOrdersInStatus }),
}));

const { createApp } = await import("../src/app");
const app = createApp();

const order = (orderNumber: string, statusCode: number, updated: string | null) => ({
  orderNumber,
  buyerName: "Sara",
  buyerMobile: "0912",
  orderDate: new Date("2026-09-01"),
  paymentDate: new Date("2026-09-02"),
  updatedAt: updated ? new Date(updated) : null,
  statusCode,
  statusTitle: "x",
  shippingMethod: "ارسال با تیپاکس",
  shippingMethodId: "4514",
  itemCount: 2,
  totalQuantity: 5,
});

async function sentRecord(orderNumber: string, photoCount: number, sentAt: Date) {
  const record = await packingRecordRepository.create({
    externalOrderId: orderNumber,
    orderNumber,
    buyerName: "Sara",
    items: [{ productCode: "A", title: "A", quantity: 1 }],
    statusCodeAfterSend: 5,
    statusTitleAfterSend: "ارسال شده",
    sentBy: null,
    sentByName: null,
    sentAt,
  });
  for (let i = 0; i < photoCount; i += 1) {
    await attachmentRepository.create({
      subjectType: AttachmentSubjectType.PACKING_RECORD,
      subjectId: String(record._id),
      originalFilename: `p${i}.jpg`,
      storedFilename: `${orderNumber}-${sentAt.getTime()}-${i}.jpg`,
      mimeType: "image/jpeg",
      size: 1,
      path: `${orderNumber}-${i}.jpg`,
    });
  }
}

describe("Status Check (orders by status)", () => {
  it("is forbidden for a role without the permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get("/api/order-status/orders").query({ statusCodes: "8" }).set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  it("requires at least one valid status code", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    expect((await request(app).get("/api/order-status/orders").set("Authorization", authHeader)).status).toBe(422);
    expect(
      (await request(app).get("/api/order-status/orders").query({ statusCodes: "999" }).set("Authorization", authHeader)).status,
    ).toBe(422);
  });

  it("defaults to the last 7 days (on last-updated date) and lists the most recently updated orders first, with per-status totals", async () => {
    countOrdersInStatus.mockImplementation(async (code: number) => (code === 8 ? 45 : null));
    listOrdersByStatuses.mockResolvedValueOnce([
      order("1", 8, "2026-09-18"),
      order("2", 10, "2026-09-20"),
      order("3", 8, null), // no update date: last
    ]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/order-status/orders").query({ statusCodes: "8,10" }).set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.days).toBe(7);
    const range = listOrdersByStatuses.mock.calls.at(-1)?.[1] as { from: Date; to: Date };
    expect(Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)).toBe(7);
    expect(listOrdersByStatuses.mock.calls.at(-1)?.[0]).toEqual([8, 10]);
    expect(res.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["2", "1", "3"]);
    expect(res.body.data.orders[0].updatedAtISO).toBe(new Date("2026-09-20").toISOString());
    expect(res.body.data.countsByStatus).toEqual([
      { statusCode: 8, statusTitle: "پردازش انبار", count: 2, totalInStatus: 45 },
      { statusCode: 10, statusTitle: "تایید حسابداری", count: 1, totalInStatus: null },
    ]);
  });

  it("supports 'all time' (days=0: no window at all)", async () => {
    countOrdersInStatus.mockResolvedValue(6896);
    listOrdersByStatuses.mockResolvedValueOnce([order("1", 5, "2024-08-05")]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app)
      .get("/api/order-status/orders")
      .query({ statusCodes: "5", days: 0 })
      .set("Authorization", authHeader);
    expect(listOrdersByStatuses.mock.calls.at(-1)).toEqual([[5], null]);
    expect(res.body.data).toMatchObject({ days: 0, rangeFromISO: null, rangeToISO: null });
  });

  it("attaches the final pictures taken in Packing to the orders that were sent with them (latest record with pictures wins; others get none)", async () => {
    countOrdersInStatus.mockResolvedValue(null);
    await sentRecord("9001", 2, new Date("2026-09-10"));
    await sentRecord("9002", 1, new Date("2026-09-10"));
    await sentRecord("9002", 0, new Date("2026-09-15")); // re-sent later without pictures: earlier pictures still shown
    await sentRecord("9003", 0, new Date("2026-09-10")); // sent with no picture
    listOrdersByStatuses.mockResolvedValueOnce([
      order("9001", 5, "2026-09-10"),
      order("9002", 5, "2026-09-15"),
      order("9003", 5, "2026-09-10"),
      order("9004", 5, "2026-09-09"), // never went through Packing
    ]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/order-status/orders").query({ statusCodes: "5" }).set("Authorization", authHeader);

    const byNumber = Object.fromEntries(res.body.data.orders.map((o: { orderNumber: string }) => [o.orderNumber, o]));
    expect(byNumber["9001"].packingPhotoUrls).toHaveLength(2);
    expect(byNumber["9001"].packingPhotoUrls[0]).toMatch(/^\/uploads\//);
    expect(byNumber["9002"].packingPhotoUrls).toHaveLength(1);
    expect(byNumber["9003"].packingPhotoUrls).toEqual([]);
    expect(byNumber["9004"].packingPhotoUrls).toEqual([]);
  });
});
