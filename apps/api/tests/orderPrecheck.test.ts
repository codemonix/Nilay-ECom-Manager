import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { OrderWorkflowStatus as S, StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";
import { fakeShopfa } from "./fakeShopfa";

vi.mock("../src/integrations/shopfa", async () => {
  const { fakeShopfa: fake } = await import("./fakeShopfa");
  return { getShopfaClient: async () => fake.client };
});

const { createApp } = await import("../src/app");
const app = createApp();

const CURRENT = "100";

async function save(available: boolean[], opts: { confirm?: boolean; orderNumber?: string; authHeader?: string } = {}) {
  const authHeader = opts.authHeader ?? (await createAuthenticatedUser(StaffRole.WAREHOUSE)).authHeader;
  return request(app)
    .post(`/api/order-precheck/orders/${opts.orderNumber ?? CURRENT}/save`)
    .set("Authorization", authHeader)
    .send({
      items: available.map((ok, i) => ({ productCode: `P${i}`, available: ok })),
      ...(opts.confirm === undefined ? {} : { confirmStatusChanges: opts.confirm }),
    });
}

/** The order under precheck plus sibling orders of the same customer, each `[orderNumber, statusCode]`. */
function givenCustomer(siblings: [string, number][], current = S.PAYMENT_CONFIRMED as number) {
  fakeShopfa.add({ orderNumber: CURRENT, statusCode: current });
  for (const [orderNumber, statusCode] of siblings) fakeShopfa.add({ orderNumber, statusCode });
}

describe("Order status machine -- precheck, every item available", () => {
  beforeEach(() => fakeShopfa.reset());

  it("no sibling orders at all -> SENT_TO_POST", async () => {
    givenCustomer([]);
    const res = await save([true, true]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.SENT_TO_POST, warning: null, relatedOrders: [] });
    expect(fakeShopfa.status(CURRENT)).toBe(S.SENT_TO_POST);
  });

  it("shipped, delivered, cancelled, deleted and abandoned-checkout orders don't count as siblings -> SENT_TO_POST", async () => {
    const ignored: [string, number][] = [
      ["200", S.SENT],
      ["201", S.CANCELED],
      ["202", S.DELETED],
      ["203", S.FORM_NOT_COMPLETED],
      ["204", S.FORM_COMPLETED],
      ["205", S.DELIVERED],
    ];
    givenCustomer(ignored);
    const res = await save([true]);
    expect(res.body.data).toMatchObject({ statusCode: S.SENT_TO_POST, warning: null, relatedOrders: [] });
    for (const [orderNumber, statusCode] of ignored) expect(fakeShopfa.status(orderNumber)).toBe(statusCode);
  });

  it("excluded orders don't stop the all-ACCOUNTING_APPROVED release either", async () => {
    givenCustomer([
      ["200", S.ACCOUNTING_APPROVED],
      ["201", S.DELETED],
      ["202", S.FORM_NOT_COMPLETED],
    ]);
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("200")).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("201")).toBe(S.DELETED);
  });

  it("every sibling is ACCOUNTING_APPROVED -> this order and all siblings go to SENT_TO_POST", async () => {
    givenCustomer([
      ["200", S.ACCOUNTING_APPROVED],
      ["201", S.ACCOUNTING_APPROVED],
      ["202", S.SENT], // excluded
    ]);
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.SENT_TO_POST);
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["200", "201"]);
    expect(res.body.data.relatedOrders[0]).toMatchObject({ fromStatusTitle: "تایید حسابداری", toStatusCode: S.SENT_TO_POST });
    expect(fakeShopfa.status("200")).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("201")).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("202")).toBe(S.SENT);
  });

  it.each([
    ["PAYMENT_CONFIRMED", S.PAYMENT_CONFIRMED],
    ["WAREHOUSE_PROCESSING", S.WAREHOUSE_PROCESSING],
    ["PAYMENT_DECLARED", S.PAYMENT_DECLARED],
  ])("a sibling still in %s -> this order waits in ACCOUNTING_APPROVED, siblings untouched", async (_name, pending) => {
    givenCustomer([
      ["200", pending],
      ["201", S.ACCOUNTING_APPROVED],
    ]);
    const res = await save([true, true]);
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.ACCOUNTING_APPROVED, warning: null, relatedOrders: [] });
    expect(fakeShopfa.status("200")).toBe(pending);
    expect(fakeShopfa.status("201")).toBe(S.ACCOUNTING_APPROVED);
  });

  it("a pending sibling wins over a mixed combination (pending + SENT_TO_POST) -> ACCOUNTING_APPROVED", async () => {
    givenCustomer([
      ["200", S.PAYMENT_DECLARED],
      ["201", S.SENT_TO_POST],
    ]);
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);
    expect(fakeShopfa.status("201")).toBe(S.SENT_TO_POST);
  });

  it.each([
    ["a sibling already SENT_TO_POST", [["200", S.SENT_TO_POST]]],
    ["a sibling in READY_TO_SEND", [["200", S.READY_TO_SEND]]],
    ["ACCOUNTING_APPROVED mixed with SENT_TO_POST", [["200", S.ACCOUNTING_APPROVED], ["201", S.SENT_TO_POST]]],
    ["a sibling in an unrelated status (after-sales service, 14)", [["200", 14]]],
    ["an unpaid sibling awaiting deposit (17)", [["200", 17]]],
  ] as [string, [string, number][]][])("mixed/unmatched siblings (%s) -> READY_TO_SEND with a check-Shopfa warning, siblings untouched", async (_name, siblings) => {
    givenCustomer(siblings);
    const res = await save([true]);
    expect(res.body.data).toMatchObject({
      saved: true,
      statusCode: S.READY_TO_SEND,
      statusTitle: "آماده به ارسال",
      warning: "check_shopfa_panel",
      relatedOrders: [],
    });
    for (const [orderNumber, statusCode] of siblings) expect(fakeShopfa.status(orderNumber)).toBe(statusCode);
  });

  it("another customer's orders are never siblings (different mobile and name)", async () => {
    givenCustomer([]);
    fakeShopfa.add({ orderNumber: "300", statusCode: S.PAYMENT_CONFIRMED, buyerName: "Someone Else", buyerMobile: "09990000000" });
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.SENT_TO_POST);
  });

  it("matches the customer by mobile across formats (+98 vs 09...)", async () => {
    givenCustomer([]);
    fakeShopfa.add({ orderNumber: "200", statusCode: S.PAYMENT_DECLARED, buyerName: "S. Karimi", buyerMobile: "+98 912 111 2233" });
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);
  });

  it("matches a customer without a mobile number by name", async () => {
    fakeShopfa.add({ orderNumber: CURRENT, statusCode: S.PAYMENT_CONFIRMED, buyerName: "Reza Ahmadi", buyerMobile: null });
    fakeShopfa.add({ orderNumber: "200", statusCode: S.WAREHOUSE_PROCESSING, buyerName: "reza  ahmadi", buyerMobile: null });
    fakeShopfa.add({ orderNumber: "201", statusCode: S.WAREHOUSE_PROCESSING, buyerName: "Someone Ahmadi", buyerMobile: null });
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);
  });

  it("clears a previous shortage marker from the note but keeps staff free text", async () => {
    givenCustomer([], S.WAREHOUSE_PROCESSING);
    fakeShopfa.orders.get(CURRENT)!.note = "[پیش‌بررسی سفارش - کدهای ناموجود: P0]\ncall the customer first";
    await save([true]);
    expect(fakeShopfa.note(CURRENT)).toBe("call the customer first");
  });

  it("reports a failed sibling update without undoing the saved order", async () => {
    givenCustomer([
      ["200", S.ACCOUNTING_APPROVED],
      ["201", S.ACCOUNTING_APPROVED],
    ]);
    fakeShopfa.failNext("updateOrderStatus");
    const res = await save([true]);
    expect(res.body.data.saved).toBe(true);
    expect(fakeShopfa.status(CURRENT)).toBe(S.SENT_TO_POST);
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["201"]);
    expect(res.body.data.relatedFailures).toEqual([{ orderNumber: "200", message: "Failed to reach Shopfa order service" }]);
    expect(fakeShopfa.status("200")).toBe(S.ACCOUNTING_APPROVED);
  });
});

describe("Order status machine -- precheck, shortage in the current order", () => {
  beforeEach(() => fakeShopfa.reset());

  it("no sibling in SENT_TO_POST -> WAREHOUSE_PROCESSING straight away, with the unavailable codes in the note", async () => {
    givenCustomer([
      ["200", S.ACCOUNTING_APPROVED],
      ["201", S.WAREHOUSE_PROCESSING],
    ]);
    const res = await save([true, false, false]);
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.WAREHOUSE_PROCESSING, unavailableProductCodes: ["P1", "P2"] });
    expect(fakeShopfa.note(CURRENT)).toBe("[پیش‌بررسی سفارش - کدهای ناموجود: P1, P2]");
    expect(fakeShopfa.status("200")).toBe(S.ACCOUNTING_APPROVED);
    expect(fakeShopfa.status("201")).toBe(S.WAREHOUSE_PROCESSING);
  });

  it("siblings in SENT_TO_POST and no confirmation -> asks first and changes NOTHING", async () => {
    givenCustomer([
      ["200", S.SENT_TO_POST],
      ["201", S.SENT_TO_POST],
      ["202", S.ACCOUNTING_APPROVED],
    ]);
    const res = await save([true, false]);
    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(false);
    expect(res.body.data.relatedOrders).toEqual([
      { orderNumber: "200", fromStatusTitle: "ارسال شده به سرویس پستی", toStatusCode: S.ACCOUNTING_APPROVED, toStatusTitle: "تایید حسابداری" },
      { orderNumber: "201", fromStatusTitle: "ارسال شده به سرویس پستی", toStatusCode: S.ACCOUNTING_APPROVED, toStatusTitle: "تایید حسابداری" },
    ]);
    expect(fakeShopfa.statusWrites).toEqual([]);
    expect(fakeShopfa.note(CURRENT)).toBe("");
  });

  it("siblings in SENT_TO_POST and confirmed -> they go back to ACCOUNTING_APPROVED, this order to WAREHOUSE_PROCESSING", async () => {
    givenCustomer([
      ["200", S.SENT_TO_POST],
      ["202", S.ACCOUNTING_APPROVED],
    ]);
    const res = await save([false], { confirm: true });
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.WAREHOUSE_PROCESSING });
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["200"]);
    expect(fakeShopfa.status(CURRENT)).toBe(S.WAREHOUSE_PROCESSING);
    expect(fakeShopfa.status("200")).toBe(S.ACCOUNTING_APPROVED);
    expect(fakeShopfa.status("202")).toBe(S.ACCOUNTING_APPROVED);
  });

  it("only SENT_TO_POST siblings are pulled back; excluded ones are never touched", async () => {
    givenCustomer([
      ["200", S.SENT_TO_POST],
      ["201", S.SENT],
      ["202", S.DELETED],
    ]);
    const res = await save([false], { confirm: true });
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["200"]);
    expect(fakeShopfa.status("201")).toBe(S.SENT);
    expect(fakeShopfa.status("202")).toBe(S.DELETED);
  });

  it("the confirm flag is harmless when nothing needs confirming", async () => {
    givenCustomer([]);
    const res = await save([false], { confirm: true });
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.WAREHOUSE_PROCESSING, relatedOrders: [] });
  });
});

describe("Order status machine -- precheck, multi-step flows and audit log", () => {
  beforeEach(() => fakeShopfa.reset());

  it("two orders of one customer: first waits in ACCOUNTING_APPROVED, second releases both to SENT_TO_POST", async () => {
    fakeShopfa.add({ orderNumber: "A", statusCode: S.PAYMENT_CONFIRMED });
    fakeShopfa.add({ orderNumber: "B", statusCode: S.PAYMENT_CONFIRMED });

    const first = await save([true], { orderNumber: "A" });
    expect(first.body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);

    const second = await save([true], { orderNumber: "B" });
    expect(second.body.data.statusCode).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("A")).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("B")).toBe(S.SENT_TO_POST);
  });

  it("a shortage found later pulls the released sibling back, and a re-check once stocked releases both again", async () => {
    fakeShopfa.add({ orderNumber: "A", statusCode: S.SENT_TO_POST });
    fakeShopfa.add({ orderNumber: "B", statusCode: S.PAYMENT_CONFIRMED });

    const ask = await save([false], { orderNumber: "B" });
    expect(ask.body.data.saved).toBe(false);
    await save([false], { orderNumber: "B", confirm: true });
    expect(fakeShopfa.status("A")).toBe(S.ACCOUNTING_APPROVED);
    expect(fakeShopfa.status("B")).toBe(S.WAREHOUSE_PROCESSING);

    // Stock arrived: B is re-checked from WAREHOUSE_PROCESSING; its only sibling is ACCOUNTING_APPROVED.
    const recheck = await save([true], { orderNumber: "B" });
    expect(recheck.body.data.statusCode).toBe(S.SENT_TO_POST);
    expect(fakeShopfa.status("A")).toBe(S.SENT_TO_POST);
  });

  it("records every applied change (current and siblings) with who made it, readable from order history", async () => {
    givenCustomer([["200", S.ACCOUNTING_APPROVED]]);
    const { authHeader, user } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    await save([true], { authHeader });

    const current = await request(app).get(`/api/order-history/${CURRENT}`).set("Authorization", authHeader);
    expect(current.status).toBe(200);
    expect(current.body.data.statusChanges).toEqual([
      expect.objectContaining({
        fromStatusCode: S.PAYMENT_CONFIRMED,
        toStatusCode: S.SENT_TO_POST,
        source: "precheck",
        changedByName: user.name,
      }),
    ]);
    const sibling = await request(app).get("/api/order-history/200").set("Authorization", authHeader);
    expect(sibling.body.data.statusChanges).toEqual([
      expect.objectContaining({ fromStatusCode: S.ACCOUNTING_APPROVED, toStatusCode: S.SENT_TO_POST }),
    ]);
  });

  it("records nothing when the user still has to confirm", async () => {
    givenCustomer([["200", S.SENT_TO_POST]]);
    const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
    await save([false], { authHeader });
    const history = await request(app).get(`/api/order-history/${CURRENT}`).set("Authorization", authHeader);
    expect(history.body.data.statusChanges).toEqual([]);
  });

  it("404s for an unknown order", async () => {
    const res = await save([true], { orderNumber: "nope" });
    expect(res.status).toBe(404);
  });

  it("order history is closed to roles without precheck or packing access", async () => {
    const { authHeader } = await createAuthenticatedUser(StaffRole.PURCHASING);
    const res = await request(app).get(`/api/order-history/${CURRENT}`).set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });
});
