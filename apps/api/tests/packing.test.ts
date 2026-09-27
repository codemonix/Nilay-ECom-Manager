import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { OrderWorkflowStatus as S, ShopfaSyncStatus, StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";
import { fakeShopfa } from "./fakeShopfa";
import { PackingRecordModel } from "../src/models/PackingRecord";
import { PACKING_SYNC_MAX_ATTEMPTS, backoffMs, runDueSyncs } from "../src/services/packingSyncService";
import { buildPackingPhotoNote, parsePackingPhotoCount } from "../src/integrations/shopfa/packingNoteMarker";

vi.mock("../src/integrations/shopfa", async () => {
  const { fakeShopfa: fake } = await import("./fakeShopfa");
  return { getShopfaClient: async () => fake.client };
});

const { createApp } = await import("../src/app");
const app = createApp();

const snapshot = (orderNumber: string, buyerName = "Sara Karimi") => ({
  orderNumber,
  externalOrderId: `ext-${orderNumber}`,
  buyerName,
  items: [{ productCode: "BBB", title: "Item B", quantity: 1 }],
});

async function send(orderNumbers: string[], photoCount = 0, authHeader?: string) {
  const header = authHeader ?? (await createAuthenticatedUser(StaffRole.WAREHOUSE)).authHeader;
  let req = request(app)
    .post("/api/packing/send")
    .set("Authorization", header)
    .field("orders", JSON.stringify(orderNumbers.map((n) => snapshot(n))));
  for (let i = 0; i < photoCount; i += 1) {
    req = req.attach("photos", Buffer.from(`photo-${i}`), { filename: `p${i}.jpg`, contentType: "image/jpeg" });
  }
  return req;
}

async function listQueue(query: Record<string, unknown> = {}) {
  const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
  return request(app).get("/api/packing/orders").query(query).set("Authorization", authHeader);
}

/** Moves every PENDING_SYNC record's backoff into the past, as if its retry time had come. */
async function makeRetriesDue() {
  await PackingRecordModel.updateMany({ syncStatus: ShopfaSyncStatus.PENDING_SYNC }, { $set: { nextSyncAt: new Date(0) } });
}

describe("Packing -- the queue (building packing groups)", () => {
  beforeEach(() => fakeShopfa.reset());

  it("rejects requests from a role without the packing permission", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  it("only lists SENT_TO_POST orders", async () => {
    fakeShopfa.add({ orderNumber: "1", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "2", statusCode: S.ACCOUNTING_APPROVED });
    fakeShopfa.add({ orderNumber: "3", statusCode: S.SENT });
    const res = await listQueue({ days: 30 });
    expect(res.status).toBe(200);
    expect(res.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["1"]);
    expect(res.body.data).toMatchObject({ days: 30, statusTotal: 1, failedSyncs: [], pendingSyncCount: 0 });
  });

  it("groups one customer's orders together by mobile (formats normalized), falling back to name, groups ordered by oldest payment", async () => {
    const mk = (orderNumber: string, buyerName: string | null, buyerMobile: string | null, paid: string) =>
      fakeShopfa.add({ orderNumber, buyerName, buyerMobile, statusCode: S.SENT_TO_POST, orderDate: new Date(paid), paymentDate: new Date(paid) });
    mk("1", "Sara", "09121112233", "2026-09-05");
    mk("2", "Ali", "09355556666", "2026-09-01");
    mk("3", "Sara K", "+98 912 111 2233", "2026-09-02");
    mk("4", "Reza", null, "2026-09-03");
    mk("5", "reza", null, "2026-09-04");
    const res = await listQueue();
    // Ali's group is oldest (09-01); Sara's two orders (09-02 / 09-05) come next together; Reza's two (by name) last.
    expect(res.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["2", "3", "1", "4", "5"]);
    const [, sara1, sara2] = res.body.data.orders;
    expect(sara1.customerGroupKey).toBe(sara2.customerGroupKey);
  });

  it("returns each order's shipping method, so the page can summarize a group's methods", async () => {
    fakeShopfa.add({ orderNumber: "1", statusCode: S.SENT_TO_POST, shippingMethod: "ارسال تیپاکس" });
    fakeShopfa.add({ orderNumber: "2", statusCode: S.SENT_TO_POST, shippingMethod: null, buyerMobile: "09355556666" });
    const res = await listQueue();
    const byNumber = Object.fromEntries(res.body.data.orders.map((o: { orderNumber: string }) => [o.orderNumber, o]));
    expect(byNumber["1"].shippingMethod).toBe("ارسال تیپاکس");
    expect(byNumber["2"].shippingMethod).toBeNull();
  });

  it("customer-orders lists the customer's orders in other statuses (not the group itself, not shipped/cancelled), for information", async () => {
    fakeShopfa.add({ orderNumber: "1", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "2", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "3", statusCode: S.WAREHOUSE_PROCESSING });
    fakeShopfa.add({ orderNumber: "4", statusCode: S.ACCOUNTING_APPROVED, buyerMobile: "+98 912 111 2233" });
    fakeShopfa.add({ orderNumber: "5", statusCode: S.SENT });
    fakeShopfa.add({ orderNumber: "6", statusCode: S.CANCELED });
    fakeShopfa.add({ orderNumber: "7", statusCode: S.PAYMENT_DECLARED, buyerName: "Other", buyerMobile: "09990000000" });
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).get("/api/packing/customer-orders").query({ orderNumber: "1" }).set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      orderNumber: "1",
      otherStatusOrders: [
        { orderNumber: "3", statusCode: S.WAREHOUSE_PROCESSING, statusTitle: "پردازش انبار" },
        { orderNumber: "4", statusCode: S.ACCOUNTING_APPROVED, statusTitle: "تایید حسابداری" },
      ],
    });
  });

  it("customer-orders 404s for an unknown order and requires orderNumber", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    expect((await request(app).get("/api/packing/customer-orders").query({ orderNumber: "x" }).set("Authorization", authHeader)).status).toBe(404);
    expect((await request(app).get("/api/packing/customer-orders").set("Authorization", authHeader)).status).toBe(422);
  });

  it("loads ALL orders in the status by default (no time window); a chosen window is passed through", async () => {
    const spy = vi.spyOn(fakeShopfa.client, "listOrdersByStatusForPacking");
    const all = await listQueue();
    expect(spy.mock.calls.at(-1)).toEqual([S.SENT_TO_POST, null]);
    expect(all.body.data).toMatchObject({ days: 0, rangeFromISO: null, rangeToISO: null });

    const windowed = await listQueue({ days: 60 });
    const range = spy.mock.calls.at(-1)?.[1] as { from: Date; to: Date };
    expect(Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)).toBe(60);
    expect(windowed.body.data.rangeFromISO).toBe(range.from.toISOString());
    spy.mockRestore();
  });
});

describe("Packing -- Save (finalizeAndSend) and the Shopfa push", () => {
  beforeEach(() => fakeShopfa.reset());

  it("sends a whole group without photos: every order becomes SENT, the note records 0 photos, history has no photos", async () => {
    fakeShopfa.add({ orderNumber: "2001", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "2002", statusCode: S.SENT_TO_POST, note: "fragile" });
    const { authHeader, user } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await send(["2001", "2002"], 0, authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.failed).toEqual([]);
    expect(res.body.data.sent).toEqual([
      expect.objectContaining({ orderNumber: "2001", syncStatus: ShopfaSyncStatus.SYNCED, photoUrls: [] }),
      expect.objectContaining({ orderNumber: "2002", syncStatus: ShopfaSyncStatus.SYNCED, photoUrls: [] }),
    ]);
    expect(fakeShopfa.status("2001")).toBe(S.SENT);
    expect(fakeShopfa.status("2002")).toBe(S.SENT);
    expect(fakeShopfa.note("2001")).toBe("[بسته‌بندی - تعداد عکس: 0]");
    expect(fakeShopfa.note("2002")).toBe("[بسته‌بندی - تعداد عکس: 0]\nfragile");

    const historyRes = await request(app).get("/api/packing/history").query({ search: "2001" }).set("Authorization", authHeader);
    expect(historyRes.body.data[0]).toMatchObject({
      photoUrls: [],
      sentByName: user.name,
      buyerName: "Sara Karimi",
      items: [{ productCode: "BBB", title: "Item B", quantity: 1 }],
      syncStatus: ShopfaSyncStatus.SYNCED,
      statusCodeAfterSend: S.SENT,
      statusTitleAfterSend: "ارسال شده",
    });
  });

  it("keeps several photos locally on every order of the group (in the order taken) and writes only their count to Shopfa", async () => {
    fakeShopfa.add({ orderNumber: "3001", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "3002", statusCode: S.SENT_TO_POST });
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);

    const res = await send(["3001", "3002"], 2, authHeader);
    expect(res.status).toBe(200);
    for (const sent of res.body.data.sent) expect(sent.photoUrls).toHaveLength(2);
    expect(fakeShopfa.note("3001")).toBe("[بسته‌بندی - تعداد عکس: 2]");
    expect(fakeShopfa.note("3001")).not.toMatch(/uploads|http/);

    const historyRes = await request(app).get("/api/packing/history").query({ search: "3002" }).set("Authorization", authHeader);
    expect(historyRes.body.data[0].photoUrls).toEqual(res.body.data.sent[1].photoUrls);
    expect(historyRes.body.data[0].photoUrls[0]).toMatch(/^\/uploads\//);
  });

  it("rejects sending with no orders", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const res = await request(app).post("/api/packing/send").set("Authorization", authHeader).field("orders", JSON.stringify([]));
    expect(res.status).toBe(422);
  });

  it("a Shopfa outage doesn't fail the send: the order is PENDING_SYNC, hidden from the queue, and still in SENT_TO_POST on Shopfa", async () => {
    fakeShopfa.add({ orderNumber: "4001", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "4002", statusCode: S.SENT_TO_POST });
    fakeShopfa.failNext("updateOrderNoteAndStatus");

    const res = await send(["4001", "4002"], 1);
    expect(res.status).toBe(200);
    expect(res.body.data.failed).toEqual([]);
    expect(res.body.data.sent.map((o: { syncStatus: string }) => o.syncStatus)).toEqual([
      ShopfaSyncStatus.PENDING_SYNC,
      ShopfaSyncStatus.SYNCED,
    ]);
    expect(fakeShopfa.status("4001")).toBe(S.SENT_TO_POST);

    const queue = await listQueue();
    expect(queue.body.data.orders).toEqual([]);
    expect(queue.body.data.pendingSyncCount).toBe(1);

    const record = await PackingRecordModel.findOne({ orderNumber: "4001" });
    expect(record).toMatchObject({ syncStatus: ShopfaSyncStatus.PENDING_SYNC, syncAttempts: 1, photoCount: 1 });
    expect(record!.lastSyncError).toMatch(/Shopfa/);
    expect(record!.nextSyncAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("the retry worker waits for the backoff, then pushes and marks the record SYNCED", async () => {
    fakeShopfa.add({ orderNumber: "5001", statusCode: S.SENT_TO_POST });
    fakeShopfa.failNext("updateOrderNoteAndStatus");
    await send(["5001"], 3);

    expect(await runDueSyncs()).toBe(0); // backoff not elapsed yet
    await makeRetriesDue();
    expect(await runDueSyncs()).toBe(1);

    expect(fakeShopfa.status("5001")).toBe(S.SENT);
    expect(fakeShopfa.note("5001")).toBe("[بسته‌بندی - تعداد عکس: 3]");
    const record = await PackingRecordModel.findOne({ orderNumber: "5001" });
    expect(record).toMatchObject({ syncStatus: ShopfaSyncStatus.SYNCED, syncAttempts: 2, lastSyncError: null, statusCodeAfterSend: S.SENT });
    expect(await runDueSyncs()).toBe(0);
  });

  it("a write Shopfa answers but doesn't apply counts as a failure and is retried", async () => {
    fakeShopfa.add({ orderNumber: "5101", statusCode: S.SENT_TO_POST });
    fakeShopfa.failNext("updateOrderNoteAndStatus", 1, "not_applied");
    const res = await send(["5101"]);
    expect(res.body.data.sent[0].syncStatus).toBe(ShopfaSyncStatus.PENDING_SYNC);
    const record = await PackingRecordModel.findOne({ orderNumber: "5101" });
    expect(record!.lastSyncError).toMatch(/expected 5/);

    await makeRetriesDue();
    await runDueSyncs();
    expect(fakeShopfa.status("5101")).toBe(S.SENT);
  });

  it(`gives up after ${PACKING_SYNC_MAX_ATTEMPTS} attempts: FAILED, listed in the queue's failedSyncs, then a manual retry syncs it`, async () => {
    fakeShopfa.add({ orderNumber: "6001", statusCode: S.SENT_TO_POST });
    fakeShopfa.failNext("updateOrderNoteAndStatus", PACKING_SYNC_MAX_ATTEMPTS);
    await send(["6001"]);
    for (let i = 1; i < PACKING_SYNC_MAX_ATTEMPTS; i += 1) {
      await makeRetriesDue();
      await runDueSyncs();
    }
    const record = await PackingRecordModel.findOne({ orderNumber: "6001" });
    expect(record).toMatchObject({ syncStatus: ShopfaSyncStatus.FAILED, syncAttempts: PACKING_SYNC_MAX_ATTEMPTS, nextSyncAt: null });

    // FAILED is never retried automatically.
    await makeRetriesDue();
    expect(await runDueSyncs()).toBe(0);

    const queue = await listQueue();
    expect(queue.body.data.orders).toEqual([]); // physically packed: not offered again
    expect(queue.body.data.failedSyncs).toEqual([
      expect.objectContaining({ packingRecordId: String(record!._id), orderNumber: "6001", lastSyncError: expect.any(String) }),
    ]);

    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const retry = await request(app).post(`/api/packing/records/${String(record!._id)}/retry-sync`).set("Authorization", authHeader);
    expect(retry.status).toBe(200);
    expect(retry.body.data.syncStatus).toBe(ShopfaSyncStatus.SYNCED);
    expect(fakeShopfa.status("6001")).toBe(S.SENT);
    expect((await listQueue()).body.data.failedSyncs).toEqual([]);
  });

  it("an order that no longer exists on Shopfa fails right away (retrying can't help)", async () => {
    const res = await send(["ghost"]);
    expect(res.body.data.sent[0].syncStatus).toBe(ShopfaSyncStatus.FAILED);
    const record = await PackingRecordModel.findOne({ orderNumber: "ghost" });
    expect(record).toMatchObject({ syncStatus: ShopfaSyncStatus.FAILED, syncAttempts: 1, lastSyncError: "Order not found on Shopfa" });
  });

  it("manual retry of an already-synced record is a no-op; of an unknown record is a 404", async () => {
    fakeShopfa.add({ orderNumber: "7001", statusCode: S.SENT_TO_POST });
    const res = await send(["7001"]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const again = await request(app).post(`/api/packing/records/${res.body.data.sent[0].packingRecordId}/retry-sync`).set("Authorization", authHeader);
    expect(again.body.data.syncStatus).toBe(ShopfaSyncStatus.SYNCED);
    expect(fakeShopfa.statusWrites).toHaveLength(1);
    const missing = await request(app).post("/api/packing/records/64b000000000000000000000/retry-sync").set("Authorization", authHeader);
    expect(missing.status).toBe(404);
  });

  it("an order packed before sync tracking existed (record has no syncStatus) is not hidden from the queue", async () => {
    fakeShopfa.add({ orderNumber: "8101", statusCode: S.SENT_TO_POST });
    await PackingRecordModel.collection.insertOne({
      externalOrderId: "1",
      orderNumber: "8101",
      buyerName: null,
      items: [],
      statusCodeAfterSend: S.SENT,
      statusTitleAfterSend: "ارسال شده",
      sentAt: new Date("2026-09-17T19:33:49Z"),
    });
    const queue = await listQueue();
    expect(queue.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["8101"]);
    expect(queue.body.data).toMatchObject({ pendingSyncCount: 0, failedSyncs: [] });
  });

  it("a packed order re-opened on Shopfa (moved back to SENT_TO_POST after it synced) shows up in the queue again", async () => {
    fakeShopfa.add({ orderNumber: "8001", statusCode: S.SENT_TO_POST });
    await send(["8001"]);
    fakeShopfa.orders.get("8001")!.statusCode = S.SENT_TO_POST;
    const queue = await listQueue();
    expect(queue.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["8001"]);
  });

  it("order history shows the precheck-to-packing status changes and the packing pass with its pictures and sync state", async () => {
    fakeShopfa.add({ orderNumber: "9001", statusCode: S.SENT_TO_POST });
    const { authHeader, user } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    fakeShopfa.failNext("updateOrderNoteAndStatus");
    await send(["9001"], 1, authHeader);

    const pending = await request(app).get("/api/order-history/9001").set("Authorization", authHeader);
    expect(pending.body.data.statusChanges).toEqual([]); // nothing reached Shopfa yet
    expect(pending.body.data.packings).toEqual([
      expect.objectContaining({ syncStatus: ShopfaSyncStatus.PENDING_SYNC, syncAttempts: 1, photoUrls: [expect.stringMatching(/^\/uploads\//)] }),
    ]);

    await makeRetriesDue();
    await runDueSyncs();
    const synced = await request(app).get("/api/order-history/9001").set("Authorization", authHeader);
    expect(synced.body.data.statusChanges).toEqual([
      expect.objectContaining({ fromStatusCode: S.SENT_TO_POST, toStatusCode: S.SENT, source: "packing", changedByName: user.name }),
    ]);
    expect(synced.body.data.packings[0].syncStatus).toBe(ShopfaSyncStatus.SYNCED);
  });
});

describe("Packing -- sync helpers", () => {
  it("backoff doubles from one minute and caps at an hour", () => {
    expect([1, 2, 3, 4, 7, 8, 20].map((n) => backoffMs(n) / 60_000)).toEqual([1, 2, 4, 8, 60, 60, 60]);
  });

  it("the photo-count marker replaces a previous one instead of stacking, and keeps other note text", () => {
    const once = buildPackingPhotoNote("[پیش‌بررسی سفارش - کدهای ناموجود: 1]\nhello", 2);
    expect(once).toBe("[بسته‌بندی - تعداد عکس: 2]\n[پیش‌بررسی سفارش - کدهای ناموجود: 1]\nhello");
    const twice = buildPackingPhotoNote(once, 5);
    expect(twice).toBe("[بسته‌بندی - تعداد عکس: 5]\n[پیش‌بررسی سفارش - کدهای ناموجود: 1]\nhello");
    expect(parsePackingPhotoCount(twice)).toBe(5);
    expect(parsePackingPhotoCount("nothing here")).toBeNull();
    expect(buildPackingPhotoNote("", 0)).toBe("[بسته‌بندی - تعداد عکس: 0]");
  });
});

describe("Order status machine -- full journey through precheck and packing", () => {
  beforeEach(() => fakeShopfa.reset());

  it("two orders of one customer: precheck releases them together, packing ships them together", async () => {
    fakeShopfa.add({ orderNumber: "A", statusCode: S.PAYMENT_CONFIRMED });
    fakeShopfa.add({ orderNumber: "B", statusCode: S.PAYMENT_CONFIRMED });
    fakeShopfa.add({ orderNumber: "C", statusCode: S.PAYMENT_DECLARED, buyerName: "Other", buyerMobile: "09990000000" });
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    const precheck = (orderNumber: string) =>
      request(app)
        .post(`/api/order-precheck/orders/${orderNumber}/save`)
        .set("Authorization", authHeader)
        .send({ items: [{ productCode: "7724765", available: true }] });

    expect((await precheck("A")).body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);
    expect((await precheck("B")).body.data.statusCode).toBe(S.SENT_TO_POST);

    const queue = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    const group = queue.body.data.orders;
    expect(group.map((o: { orderNumber: string }) => o.orderNumber).sort()).toEqual(["A", "B"]);
    expect(group[0].customerGroupKey).toBe(group[1].customerGroupKey);

    const sent = await send(["A", "B"], 1, authHeader);
    expect(sent.body.data.sent.every((o: { syncStatus: string }) => o.syncStatus === ShopfaSyncStatus.SYNCED)).toBe(true);
    expect(fakeShopfa.status("A")).toBe(S.SENT);
    expect(fakeShopfa.status("B")).toBe(S.SENT);
    expect(fakeShopfa.status("C")).toBe(S.PAYMENT_DECLARED);

    const history = await request(app).get("/api/order-history/A").set("Authorization", authHeader);
    expect(history.body.data.statusChanges.map((c: { toStatusCode: number }) => c.toStatusCode)).toEqual([
      S.ACCOUNTING_APPROVED,
      S.SENT_TO_POST,
      S.SENT,
    ]);
  });
});
