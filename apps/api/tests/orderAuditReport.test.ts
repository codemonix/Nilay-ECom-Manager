import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  AttachmentSubjectType,
  OrderAuditEventType,
  OrderStatusChangeSource,
  ReportKey,
  ShopfaSyncStatus,
  StaffRole,
} from "@complaint-system/shared";
import { createAuthenticatedUser, createTestUser } from "./testUtils";
import { AttachmentModel } from "../src/models/Attachment";
import { UserModel } from "../src/models/User";
import { orderStatusChangeRepository } from "../src/repositories/orderStatusChangeRepository";
import { packingRecordRepository } from "../src/repositories/packingRecordRepository";
import { createApp } from "../src/app";

const app = createApp();
const URL = "/api/reporting/order-audit";
const PERIOD = { from: "2026-09-01", to: "2026-09-30" };

type Actor = { id: string; name: string };

async function actor(name: string): Promise<Actor> {
  const user = await createTestUser(StaffRole.WAREHOUSE);
  await UserModel.updateOne({ _id: user._id }, { name });
  return { id: String(user._id), name };
}

async function statusChange(orderNumber: string, by: Actor | null, at: string, toStatusCode = 5) {
  return orderStatusChangeRepository.create({
    orderNumber,
    fromStatusCode: 8,
    toStatusCode,
    toStatusTitle: "ارسال شده",
    source: OrderStatusChangeSource.PACKING,
    changedBy: by?.id ?? null,
    changedByName: by?.name ?? null,
    changedAt: new Date(at),
  });
}

let fileCounter = 0;
async function packed(orderNumber: string, by: Actor, at: string, photos = 0) {
  const record = await packingRecordRepository.create({
    externalOrderId: orderNumber,
    orderNumber,
    buyerName: "Sara",
    items: [{ productCode: "A", title: "A", quantity: 1 }],
    photoCount: photos,
    syncStatus: ShopfaSyncStatus.PENDING_SYNC,
    nextSyncAt: null,
    sentBy: by.id,
    sentByName: by.name,
    sentAt: new Date(at),
  });
  const urls: string[] = [];
  for (let i = 0; i < photos; i += 1) {
    fileCounter += 1;
    const storedFilename = `audit-${fileCounter}`;
    // Created through the model so createdAt can be set: an upload's time is what the report orders by.
    await AttachmentModel.create({
      subjectType: AttachmentSubjectType.PACKING_RECORD,
      subjectId: record._id,
      originalFilename: storedFilename,
      storedFilename,
      mimeType: "image/jpeg",
      size: 1,
      path: storedFilename,
      uploadedBy: by.id,
      createdAt: new Date(new Date(at).getTime() + i * 1000),
    });
    urls.push(`/uploads/${storedFilename}`);
  }
  return { record, urls };
}

async function managerHeader() {
  return (await createAuthenticatedUser(StaffRole.MANAGER)).authHeader;
}

const get = async (query: Record<string, string>) => request(app).get(URL).query({ ...PERIOD, ...query }).set("Authorization", await managerHeader());

describe("Order Activity Log report", () => {
  it("is forbidden without the report's own permission", async () => {
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.MANAGER);
    await UserModel.updateOne({ _id: user._id }, { permissions: [ReportKey.ORDER_HISTORY] });
    expect((await request(app).get(URL).query(PERIOD).set("Authorization", authHeader)).status).toBe(403);
  });

  it("validates the period and filters", async () => {
    const header = await managerHeader();
    expect((await request(app).get(URL).set("Authorization", header)).status).toBe(422);
    expect((await request(app).get(URL).query({ ...PERIOD, userId: "nope" }).set("Authorization", header)).status).toBe(422);
    expect((await request(app).get(URL).query({ ...PERIOD, type: "nope" }).set("Authorization", header)).status).toBe(422);
    expect((await request(app).get(URL).query({ ...PERIOD, pageSize: "7" }).set("Authorization", header)).status).toBe(422);
  });

  it("merges status changes, packing sends and picture uploads newest first, with per-user totals", async () => {
    const ali = await actor("Ali");
    const sara = await actor("Sara");
    await statusChange("100", ali, "2026-09-10T08:00:00Z", 9);
    const { record, urls } = await packed("100", sara, "2026-09-10T09:00:00Z", 2);
    await statusChange("100", sara, "2026-09-10T09:00:05Z");
    await statusChange("200", null, "2026-09-11T10:00:00Z");
    // Outside the period.
    await statusChange("300", ali, "2026-08-31T10:00:00Z");
    await statusChange("300", ali, "2026-10-01T10:00:00Z");

    const res = await get({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, pageSize: 50, total: 5 });
    expect(res.body.data.events.map((event: { type: string; orderNumber: string }) => `${event.type}:${event.orderNumber}`)).toEqual([
      "status_changed:200",
      "status_changed:100",
      "photos_uploaded:100",
      "order_packed:100",
      "status_changed:100",
    ]);
    expect(res.body.data.events[0]).toMatchObject({ actorId: null, actorName: null });
    expect(res.body.data.events[1]).toMatchObject({
      actorId: sara.id,
      actorName: "Sara",
      fromStatusCode: 8,
      fromStatusTitle: expect.any(String),
      toStatusCode: 5,
      toStatusTitle: "ارسال شده",
      source: OrderStatusChangeSource.PACKING,
    });
    expect(res.body.data.events[2]).toMatchObject({ actorId: sara.id, actorName: "Sara", photoUrls: urls });
    expect(res.body.data.events[3]).toMatchObject({
      id: `order_packed:${String(record._id)}`,
      actorName: "Sara",
      buyerName: "Sara",
      syncStatus: ShopfaSyncStatus.PENDING_SYNC,
    });
    expect(res.body.data.summary).toEqual([
      { actorId: sara.id, actorName: "Sara", statusChanges: 1, ordersPacked: 1, photosUploaded: 2 },
      { actorId: ali.id, actorName: "Ali", statusChanges: 1, ordersPacked: 0, photosUploaded: 0 },
      { actorId: null, actorName: null, statusChanges: 1, ordersPacked: 0, photosUploaded: 0 },
    ]);
  });

  it("filters by user, order number and kind of action", async () => {
    const ali = await actor("Ali");
    const sara = await actor("Sara");
    await statusChange("100", ali, "2026-09-10T08:00:00Z");
    await packed("100", sara, "2026-09-10T09:00:00Z", 1);
    await packed("200", sara, "2026-09-12T09:00:00Z", 1);

    const byUser = await get({ userId: ali.id });
    expect(byUser.body.data.total).toBe(1);
    expect(byUser.body.data.events[0]).toMatchObject({ type: OrderAuditEventType.STATUS_CHANGED, actorName: "Ali" });
    expect(byUser.body.data.summary).toHaveLength(1);

    // Persian digits are accepted for the order number.
    const byOrder = await get({ orderNumber: "۲۰۰" });
    expect(byOrder.body.data.events.map((event: { type: string; orderNumber: string }) => `${event.type}:${event.orderNumber}`)).toEqual([
      "photos_uploaded:200",
      "order_packed:200",
    ]);

    const byType = await get({ type: OrderAuditEventType.PHOTOS_UPLOADED });
    expect(byType.body.data.total).toBe(2);
    expect(byType.body.data.events.every((event: { type: string }) => event.type === OrderAuditEventType.PHOTOS_UPLOADED)).toBe(true);
    expect(byType.body.data.summary).toEqual([
      { actorId: sara.id, actorName: "Sara", statusChanges: 0, ordersPacked: 0, photosUploaded: 2 },
    ]);
  });

  it("pages through the merged list", async () => {
    const ali = await actor("Ali");
    for (let i = 0; i < 30; i += 1) {
      const minute = String(i).padStart(2, "0");
      if (i % 2 === 0) await statusChange(String(1000 + i), ali, `2026-09-15T10:${minute}:00Z`);
      else await packed(String(1000 + i), ali, `2026-09-15T10:${minute}:00Z`);
    }
    const second = await get({ pageSize: "25", page: "2" });
    expect(second.body.data).toMatchObject({ page: 2, pageSize: 25, total: 30 });
    expect(second.body.data.events.map((event: { orderNumber: string }) => event.orderNumber)).toEqual(["1004", "1003", "1002", "1001", "1000"]);
  });
});
