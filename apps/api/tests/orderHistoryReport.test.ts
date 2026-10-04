import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  AttachmentSubjectType,
  CaseCategory,
  CasePriority,
  CaseSource,
  CaseStatus,
  OrderStatusChangeSource,
  ReportKey,
  ShopfaSyncStatus,
  StaffRole,
} from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";
import { attachmentRepository } from "../src/repositories/attachmentRepository";
import { caseRepository } from "../src/repositories/caseRepository";
import { orderStatusChangeRepository } from "../src/repositories/orderStatusChangeRepository";
import { packingRecordRepository } from "../src/repositories/packingRecordRepository";
import { UserModel } from "../src/models/User";
import { activityMentionsOrder, mapApiLogToOrderActivity } from "../src/integrations/shopfa/shopfaApiMapper";

const listOrdersByStatuses = vi.fn();
const searchOrdersForHistory = vi.fn();
const listOrderActivities = vi.fn();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({ listOrdersByStatuses, searchOrdersForHistory, listOrderActivities }),
}));

const { createApp } = await import("../src/app");
const app = createApp();

const URL = "/api/reporting/order-history";

const order = (orderNumber: string, statusCode: number, updated: string | null) => ({
  orderNumber,
  buyerName: "Sara",
  buyerMobile: "09121234567",
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

let storedFileCounter = 0;
async function attach(subjectType: AttachmentSubjectType, subjectId: string, mimeType = "image/jpeg") {
  storedFileCounter += 1;
  const attachment = await attachmentRepository.create({
    subjectType,
    subjectId,
    originalFilename: `f${storedFileCounter}`,
    storedFilename: `history-${storedFileCounter}`,
    mimeType,
    size: 1,
    path: `history-${storedFileCounter}`,
  });
  return `/uploads/${attachment.storedFilename}`;
}

async function sentRecord(orderNumber: string, sentAt: Date) {
  return packingRecordRepository.create({
    externalOrderId: orderNumber,
    orderNumber,
    buyerName: "Sara",
    items: [{ productCode: "A", title: "A", quantity: 1 }],
    photoCount: 0,
    syncStatus: ShopfaSyncStatus.SYNCED,
    nextSyncAt: null,
    sentBy: null,
    sentByName: "Packer",
    sentAt,
  });
}

async function caseFor(caseNumber: string, orderNumbers: string[]) {
  return caseRepository.create({
    caseNumber,
    customer: { externalCustomerId: "c1", name: "Sara" },
    subject: `Subject ${caseNumber}`,
    description: "d",
    category: CaseCategory.ORDER,
    priority: CasePriority.NORMAL,
    status: CaseStatus.OPEN,
    source: Object.values(CaseSource)[0] as string,
    relatedOrders: orderNumbers.map((orderNumber) => ({ externalOrderId: orderNumber, orderNumber })),
    lastActivityAt: new Date(),
  });
}

async function managerHeader() {
  const { authHeader } = await createAuthenticatedUser(StaffRole.MANAGER);
  return authHeader;
}

describe("Order history report", () => {
  it("is forbidden without the report's own permission", async () => {
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.MANAGER);
    await UserModel.updateOne({ _id: user._id }, { permissions: [ReportKey.CUSTOMER] });
    const res = await request(app).get(URL).query({ query: "Sara" }).set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  it("requires exactly one of a search or a known status", async () => {
    const authHeader = await managerHeader();
    const get = (query: Record<string, string>) => request(app).get(URL).query(query).set("Authorization", authHeader);
    expect((await get({})).status).toBe(422);
    expect((await get({ query: "ab" })).status).toBe(422);
    expect((await get({ statusCode: "999" })).status).toBe(422);
    expect((await get({ statusCode: "5", days: "3" })).status).toBe(422);
    expect((await get({ statusCode: "5", query: "Sara" })).status).toBe(422);
  });

  it("lists a status's orders (most recently updated first) with status changes, packing pictures and linked cases", async () => {
    listOrdersByStatuses.mockResolvedValueOnce([order("100", 5, "2026-09-18"), order("200", 5, "2026-09-20"), order("300", 5, null)]);

    await orderStatusChangeRepository.create({
      orderNumber: "100",
      fromStatusCode: 13,
      toStatusCode: 5,
      toStatusTitle: "ارسال شده",
      source: OrderStatusChangeSource.PACKING,
      changedBy: null,
      changedByName: "Packer",
      changedAt: new Date("2026-09-18T10:00:00Z"),
    });
    await orderStatusChangeRepository.create({
      orderNumber: "100",
      fromStatusCode: 4,
      toStatusCode: 13,
      toStatusTitle: "ارسال شده به سرویس پستی",
      source: OrderStatusChangeSource.PRECHECK,
      changedBy: null,
      changedByName: "Checker",
      changedAt: new Date("2026-09-17T10:00:00Z"),
    });
    const older = await sentRecord("100", new Date("2026-09-10"));
    const newer = await sentRecord("100", new Date("2026-09-18"));
    const firstPhoto = await attach(AttachmentSubjectType.PACKING_RECORD, String(newer._id));
    const secondPhoto = await attach(AttachmentSubjectType.PACKING_RECORD, String(newer._id));
    await sentRecord("999", new Date("2026-09-18")); // another order: must not leak in

    const linked = await caseFor("C-1", ["100", "200"]);
    const casePhoto = await attach(AttachmentSubjectType.CASE, String(linked._id));
    await attach(AttachmentSubjectType.CASE, String(linked._id), "application/pdf");
    await caseFor("C-2", ["999"]);

    const res = await request(app).get(URL).query({ statusCode: "5" }).set("Authorization", await managerHeader());
    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.statusCode).toBe(5);
    expect(body.days).toBe(30);
    expect(body.query).toBeNull();
    expect(body.truncated).toBe(false);
    expect(body.rangeFromISO).not.toBeNull();
    expect(listOrdersByStatuses.mock.calls.at(-1)?.[0]).toEqual([5]);
    expect(body.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["200", "100", "300"]);

    const [second, first, third] = body.orders;
    expect(first.statusChanges.map((c: { toStatusCode: number }) => c.toStatusCode)).toEqual([13, 5]);
    expect(first.statusChanges[0].changedByName).toBe("Checker");
    expect(first.packings.map((p: { packingRecordId: string }) => p.packingRecordId)).toEqual([String(newer._id), String(older._id)]);
    expect(first.packings[0].photoUrls).toEqual([firstPhoto, secondPhoto]);
    expect(first.packings[0].sentByName).toBe("Packer");
    expect(first.packings[1].photoUrls).toEqual([]);
    expect(first.cases).toHaveLength(1);
    expect(first.cases[0]).toMatchObject({ id: String(linked._id), caseNumber: "C-1", subject: "Subject C-1", status: CaseStatus.OPEN });
    // Only image attachments count as pictures.
    expect(first.cases[0].photoUrls).toEqual([casePhoto]);

    // A case linked to two orders shows under both.
    expect(second.cases.map((c: { caseNumber: string }) => c.caseNumber)).toEqual(["C-1"]);
    expect(second.statusChanges).toEqual([]);
    expect(second.packings).toEqual([]);
    expect(third).toMatchObject({ statusChanges: [], packings: [], cases: [] });
  });

  it("passes no window for the all-time range", async () => {
    listOrdersByStatuses.mockResolvedValueOnce([]);
    const res = await request(app).get(URL).query({ statusCode: "8", days: "0" }).set("Authorization", await managerHeader());
    expect(res.status).toBe(200);
    expect(listOrdersByStatuses.mock.calls.at(-1)).toEqual([[8], null]);
    expect(res.body.data.rangeFromISO).toBeNull();
    expect(res.body.data.orders).toEqual([]);
  });

  it("searches by phone number, order number or name and reports a truncated search", async () => {
    searchOrdersForHistory.mockResolvedValueOnce({ orders: [order("400", 10, "2026-09-20")], truncated: true });
    await caseFor("C-3", ["400"]);

    const res = await request(app).get(URL).query({ query: "+98 912 123 4567" }).set("Authorization", await managerHeader());
    expect(res.status).toBe(200);
    // Normalized the same way as the customer report's search.
    expect(searchOrdersForHistory).toHaveBeenLastCalledWith("09121234567");
    expect(res.body.data).toMatchObject({ query: "09121234567", statusCode: null, days: null, truncated: true });
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.orders[0].cases.map((c: { caseNumber: string }) => c.caseNumber)).toEqual(["C-3"]);
  });
});

describe("Order activities (Shopfa activity log)", () => {
  const activitiesUrl = (orderNumber: string) => `${URL}/${orderNumber}/activities`;

  it("is forbidden without the order history report permission", async () => {
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.MANAGER);
    await UserModel.updateOne({ _id: user._id }, { permissions: [ReportKey.CUSTOMER] });
    expect((await request(app).get(activitiesUrl("4783608554")).set("Authorization", authHeader)).status).toBe(403);
  });

  it("only accepts a numeric order number", async () => {
    const res = await request(app).get(activitiesUrl("Sara")).set("Authorization", await managerHeader());
    expect(res.status).toBe(422);
    expect(listOrderActivities).not.toHaveBeenCalled();
  });

  it("returns the order's activities as Shopfa reports them", async () => {
    listOrderActivities.mockResolvedValueOnce({
      activities: [
        { id: "1", event: "سبد 4783608554 ایجاد شد", statusTitle: null, at: new Date("2026-09-15T10:00:00Z"), actorName: "Sara" },
        { id: "2", event: "سبد 4783608554 در وضعیت ارسال شده قرار گرفت", statusTitle: "ارسال شده", at: null, actorName: null },
      ],
      truncated: true,
    });
    const res = await request(app).get(activitiesUrl("4783608554")).set("Authorization", await managerHeader());
    expect(res.status).toBe(200);
    expect(listOrderActivities).toHaveBeenLastCalledWith("4783608554");
    expect(res.body.data).toEqual({
      orderNumber: "4783608554",
      activities: [
        { id: "1", event: "سبد 4783608554 ایجاد شد", statusTitle: null, atISO: "2026-09-15T10:00:00.000Z", actorName: "Sara" },
        { id: "2", event: "سبد 4783608554 در وضعیت ارسال شده قرار گرفت", statusTitle: "ارسال شده", atISO: null, actorName: null },
      ],
      truncated: true,
    });
  });

  it("maps a Shopfa log row, recognizing status changes and leaving the IP out", () => {
    const activity = mapApiLogToOrderActivity({
      log_id: "292150139",
      log_type: "فروشگاه",
      log_event: "سبد 4783608554 در وضعیت ارسال شده به سرویس پستی قرار گرفت",
      log_ip: "10.0.0.1",
      log_date: "1791102870",
      log_user_id: "0",
      log_firstname: "سیستم",
      log_lastname: "",
    });
    expect(activity).toEqual({
      id: "292150139",
      event: "سبد 4783608554 در وضعیت ارسال شده به سرویس پستی قرار گرفت",
      statusTitle: "ارسال شده به سرویس پستی",
      at: new Date(1791102870 * 1000),
      actorName: "سیستم",
    });
    expect(mapApiLogToOrderActivity({ log_id: 1, log_event: "سبد 4783608554 ایجاد شد" })).toMatchObject({ statusTitle: null, at: null, actorName: null });
  });

  it("matches an order number only as a whole number", () => {
    expect(activityMentionsOrder("کالای 7724765 به سبد 4783608554 اضافه شد", "4783608554")).toBe(true);
    expect(activityMentionsOrder("سبد 47836085549 ایجاد شد", "4783608554")).toBe(false);
    expect(activityMentionsOrder("سبد 14783608554 ایجاد شد", "4783608554")).toBe(false);
    expect(activityMentionsOrder("سبد 14783608554 و 4783608554", "4783608554")).toBe(true);
  });
});
