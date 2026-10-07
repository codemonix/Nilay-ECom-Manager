import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ORDER_FOLLOW_UP_STATUS_CODE, OrderWorkflowStatus as S, StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";
import { fakeShopfa } from "./fakeShopfa";
import { OrderStatusChangeModel } from "../src/models/OrderStatusChange";

vi.mock("../src/integrations/shopfa", async () => {
  const { fakeShopfa: fake } = await import("./fakeShopfa");
  return { getShopfaClient: async () => fake.client };
});

const { createApp } = await import("../src/app");
const app = createApp();

const ORDER = "5001";
const items = [
  { productCode: "AAA", title: "Item A", imageUrl: null, quantity: 1 },
  { productCode: "BBB", title: "Item B", imageUrl: null, quantity: 2 },
];
const payload = { category: "missing_item", subject: "کسری کالا - سفارش 5001", productCodes: ["BBB"] };

async function createCase(body: Record<string, unknown> = payload, role: StaffRole = StaffRole.WAREHOUSE) {
  const { authHeader } = await createAuthenticatedUser(role);
  const res = await request(app).post(`/api/order-cases/${ORDER}`).set("Authorization", authHeader).send(body);
  return { res, authHeader };
}

beforeEach(() => {
  fakeShopfa.reset();
  fakeShopfa.add({ orderNumber: ORDER, statusCode: S.SENT_TO_POST, note: "existing note", items });
});

describe("Creating a case from an order screen", () => {
  it("creates the case from the order, sets it to follow-up and writes the case number into the admin note", async () => {
    const { res } = await createCase();

    expect(res.status).toBe(201);
    expect(res.body.data.orderSynced).toBe(true);
    const created = res.body.data.case;
    expect(created.category).toBe("missing_item");
    expect(created.source).toBe("internal");
    expect(created.customer).toMatchObject({ name: "Sara Karimi", phone: "09121112233" });
    expect(created.relatedOrders).toEqual([{ externalOrderId: "1", orderNumber: ORDER }]);
    expect(created.relatedItems).toEqual([{ externalItemId: "BBB", sku: "BBB", title: "Item B" }]);

    expect(fakeShopfa.status(ORDER)).toBe(ORDER_FOLLOW_UP_STATUS_CODE);
    expect(fakeShopfa.note(ORDER)).toBe(`existing note\n[${created.caseNumber}] پرونده ثبت شد: ${payload.subject}`);

    const audit = await OrderStatusChangeModel.find({ orderNumber: ORDER });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ toStatusCode: ORDER_FOLLOW_UP_STATUS_CODE, source: "case" });
  });

  it("needs no item", async () => {
    const { res } = await createCase({ category: "other", subject: "سایر - سفارش 5001" });
    expect(res.status).toBe(201);
    expect(res.body.data.case.relatedItems).toEqual([]);
  });

  it("rejects an item that is not on the order", async () => {
    const { res } = await createCase({ ...payload, productCodes: ["ZZZ"] });
    expect(res.status).toBe(400);
    expect(fakeShopfa.status(ORDER)).toBe(S.SENT_TO_POST);
  });

  it("still creates the case when Shopfa cannot be updated, and says so", async () => {
    fakeShopfa.failNext("updateOrderNoteAndStatus");
    const { res } = await createCase();
    expect(res.status).toBe(201);
    expect(res.body.data.orderSynced).toBe(false);
    expect(fakeShopfa.status(ORDER)).toBe(S.SENT_TO_POST);
  });

  it("is closed to staff with neither an order screen nor the Cases menu", async () => {
    const { res } = await createCase(payload, StaffRole.PURCHASING);
    expect(res.status).toBe(403);
  });

  it("lists the order's items and its open cases", async () => {
    const { res: created, authHeader } = await createCase();
    const res = await request(app).get(`/api/order-cases/${ORDER}`).set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((item: { productCode: string }) => item.productCode)).toEqual(["AAA", "BBB"]);
    expect(res.body.data.openCases).toEqual([
      { id: created.body.data.case.id, caseNumber: created.body.data.case.caseNumber, subject: payload.subject, status: "open" },
    ]);
  });
});

describe("Changing the order status when its case is resolved", () => {
  async function resolvedCase() {
    const { res } = await createCase();
    const caseId = res.body.data.case.id as string;
    const { authHeader } = await createAuthenticatedUser(StaffRole.CUSTOMER_SERVICE);
    const post = (path: string, body: Record<string, unknown>) =>
      request(app).post(`/api/cases/${caseId}/${path}`).set("Authorization", authHeader).send(body);
    return { caseId, authHeader, post };
  }

  it("moves the order to the chosen status and logs it on the case", async () => {
    const { caseId, authHeader, post } = await resolvedCase();
    await post("status", { status: "in_progress" });
    await post("status", { status: "resolved" });

    const res = await post("order-status", { orderNumber: ORDER, statusCode: S.ACCOUNTING_APPROVED });
    expect(res.status).toBe(200);
    expect(fakeShopfa.status(ORDER)).toBe(S.ACCOUNTING_APPROVED);

    const events = await request(app).get(`/api/cases/${caseId}/events`).set("Authorization", authHeader);
    const event = events.body.data.find((e: { type: string }) => e.type === "order_status_changed");
    expect(event.data).toMatchObject({ orderNumber: ORDER, statusCode: S.ACCOUNTING_APPROVED });
    expect(await OrderStatusChangeModel.countDocuments({ orderNumber: ORDER, source: "case" })).toBe(2);
  });

  it("refuses while the case is still open", async () => {
    const { post } = await resolvedCase();
    const res = await post("order-status", { orderNumber: ORDER, statusCode: S.SENT });
    expect(res.status).toBe(409);
    expect(fakeShopfa.status(ORDER)).toBe(ORDER_FOLLOW_UP_STATUS_CODE);
  });

  it("refuses a status outside the allowed list and an order that is not linked", async () => {
    const { post } = await resolvedCase();
    await post("status", { status: "in_progress" });
    await post("status", { status: "resolved" });
    expect((await post("order-status", { orderNumber: ORDER, statusCode: S.CANCELED })).status).toBe(422);
    expect((await post("order-status", { orderNumber: "9999", statusCode: S.SENT })).status).toBe(404);
  });

  it("reports a Shopfa failure instead of pretending the order changed", async () => {
    const { post } = await resolvedCase();
    await post("status", { status: "in_progress" });
    await post("status", { status: "resolved" });
    fakeShopfa.failNext("updateOrderStatus", 1, "not_applied");
    const res = await post("order-status", { orderNumber: ORDER, statusCode: S.SENT });
    expect(res.status).toBe(502);
  });
});
