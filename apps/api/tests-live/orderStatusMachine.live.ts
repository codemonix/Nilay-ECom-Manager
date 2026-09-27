import { afterAll, beforeAll, describe, expect, it } from "vitest";
import axios from "axios";
import request from "supertest";
import {
  ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES,
  OrderWorkflowStatus as S,
  ShopfaSyncStatus,
  StaffRole,
} from "@complaint-system/shared";
import { createAuthenticatedUser } from "../tests/testUtils";
import { getShopfaClient } from "../src/integrations/shopfa";
import { customerGroupKey } from "../src/utils/customerMatching";
import { parsePackingPhotoCount } from "../src/integrations/shopfa/packingNoteMarker";
import { parseOrderPrecheckUnavailableCodes } from "../src/integrations/shopfa/orderPrecheckNoteMarker";

/**
 * End-to-end check of the order status machine against the REAL Shopfa
 * store. Uses the designated test fixtures only: the customer of test order
 * 4783608554 (basket 21134791) and test product 7724765. Three throwaway
 * orders are created for that customer, driven through every precheck branch
 * and a packing save, and left cancelled ("کنسل شده") at the end -- cancelled
 * orders are not siblings, so re-runs start clean (the customer's deleted /
 * abandoned-checkout orders aren't either). The customer's name/mobile
 * are copied in-process and never printed; assertions on them compare
 * booleans so a failure diff can't leak them either.
 *
 * Refuses to start if the test customer has any other order that is not
 * shipped/cancelled, so a real order can never be touched.
 */

const TEST_BASKET_ID = "21134791";
/**
 * The Shopfa account the API key belongs to -- orders made with
 * /api/shop/orders/create are owned by it. Confirmed live (2026-09-27) that
 * create does NOT always make a new basket: if this account has an open
 * (not cancelled) basket, create puts the items into THAT one. The first
 * live run reused such a leftover basket (21204387, from 2026-09-19), so the
 * test now refuses to create while one exists, and checks every created
 * basket is brand new before touching it.
 */
const API_ACCOUNT_USER_ID = "1411241";
const TEST_PRODUCT_CODE = "7724765";
const BASE_URL = process.env.SHOPFA_API_BASE_URL!;
const API_KEY = process.env.SHOPFA_API_TOKEN!;

const http = axios.create({ baseURL: BASE_URL, timeout: 30000, maxRedirects: 0 });

async function shopfa<T = Record<string, unknown>>(endpoint: string, body: unknown, params: Record<string, unknown> = {}): Promise<T> {
  const { data } = await http.post(endpoint, body, { params: { private_key: API_KEY, ...params } });
  if (!data || data.successful === false) throw new Error(`Shopfa ${endpoint} failed: ${String(data?.error ?? "no body")}`);
  return data as T;
}

interface RawBasket {
  id: number | string;
  session: string;
  status: number | string;
  date?: number | string;
  note?: string;
  name?: string;
  family?: string;
  mobile?: string;
}

async function readBasket(id: string, fields = "id,session,status"): Promise<RawBasket> {
  const data = await shopfa<{ baskets?: RawBasket[] }>("/api/shop/orders/details", {}, { id, fields });
  const basket = data.baskets?.[0];
  if (!basket) throw new Error(`Shopfa basket ${id} not found`);
  return basket;
}

interface TestOrder {
  basketId: string;
  orderNumber: string;
  productCode: string;
}

const orders: TestOrder[] = [];
let customer: { name: string; family: string; mobile: string };
let originalStock: number | null = null;
let productId = "";
let authHeader = "";

async function setStatus(order: TestOrder, statusCode: number): Promise<void> {
  await shopfa("/api/shop/orders/update", { id: order.basketId, status: statusCode }, { id: order.basketId });
  const after = Number((await readBasket(order.basketId)).status);
  if (after !== statusCode) throw new Error(`Could not set test order ${order.orderNumber} to ${statusCode} (is ${after})`);
}

/** Puts the three test orders in the given statuses (undefined = cancelled, i.e. out of the picture). */
async function given(...statuses: (number | undefined)[]): Promise<void> {
  for (const [index, order] of orders.entries()) await setStatus(order, statuses[index] ?? S.CANCELED);
}

async function statusOf(order: TestOrder): Promise<number> {
  return Number((await readBasket(order.basketId)).status);
}

async function noteOf(order: TestOrder): Promise<string> {
  return (await readBasket(order.basketId, "id,session,status,note")).note ?? "";
}

function precheck(order: TestOrder, available: boolean, confirmStatusChanges?: boolean) {
  return request(app)
    .post(`/api/order-precheck/orders/${order.orderNumber}/save`)
    .set("Authorization", authHeader)
    .send({ items: [{ productCode: order.productCode, available }], ...(confirmStatusChanges ? { confirmStatusChanges } : {}) });
}

const { createApp } = await import("../src/app");
const app = createApp();

beforeAll(async () => {
  expect(BASE_URL.includes("://www.")).toBe(false); // a www. host 301s and silently drops POST bodies
  authHeader = (await createAuthenticatedUser(StaffRole.WAREHOUSE)).authHeader;
  const client = await getShopfaClient();

  const base = await readBasket(TEST_BASKET_ID, "id,session,status,name,family,mobile");
  if (!base.mobile) throw new Error("Test order has no mobile to copy");
  customer = { name: base.name ?? "", family: base.family ?? "", mobile: base.mobile };
  const customerKey = customerGroupKey({ buyerMobile: customer.mobile, buyerName: `${customer.name} ${customer.family}`, orderNumber: "" });

  // Safety: never run while the test customer has a sibling-relevant order we didn't create -- it would change results, and could be changed by the test.
  const active = (await client.findOrdersByCustomerQuery(customer.mobile)).filter(
    (order) => customerGroupKey(order) === customerKey && !ORDER_WORKFLOW_SIBLING_EXCLUDED_STATUS_CODES.includes(order.statusCode),
  );
  if (active.length > 0) {
    throw new Error(
      `Test customer has active orders, refusing to run: ${active.map((o) => `${o.orderNumber}(${o.statusCode})`).join(", ")}`,
    );
  }

  // Safety: /orders/create fills the API account's open basket if there is one -- never let it reuse an existing basket.
  const accountBaskets =
    (await shopfa<{ baskets?: RawBasket[] }>("/api/shop/orders", {}, { user_id: API_ACCOUNT_USER_ID, limit: 100, fields: "id,session,status" }))
      .baskets ?? [];
  const open = accountBaskets.filter((b) => Number(b.status) !== S.CANCELED);
  if (open.length > 0) {
    throw new Error(
      `API account has open baskets that /orders/create would reuse, refusing to run: ${open.map((b) => `${b.id}(${b.status})`).join(", ")}`,
    );
  }
  const startedAtSec = Math.floor(Date.now() / 1000) - 120;

  const product = await client.getProductByCode(TEST_PRODUCT_CODE);
  if (!product) throw new Error(`Test product ${TEST_PRODUCT_CODE} not found`);
  productId = product.shopfaProductId;
  originalStock = product.availableQuantity;

  for (let i = 0; i < 3; i += 1) {
    const created = await shopfa<Record<string, unknown>>("/api/shop/orders/create", {
      tax_price: "0",
      service_price: "0",
      post_price: "0",
      discount_price: "0",
      items: [{ id: productId, price: String(product.price), buy_price: String(product.price), weight: "0", count: "1" }],
    });
    const basketId = String(created.basket_id ?? created.id ?? "");
    if (!basketId) throw new Error(`Unexpected create response keys: ${Object.keys(created).join(",")}`);
    const fresh = await readBasket(basketId, "id,session,status,date");
    if (Number(fresh.date) < startedAtSec) {
      throw new Error(`/orders/create returned pre-existing basket ${basketId}; left untouched, check it manually`);
    }
    await shopfa(
      "/api/shop/orders/update",
      { id: basketId, name: customer.name, family: customer.family, mobile: customer.mobile, status: S.CANCELED },
      { id: basketId },
    );
    const basket = await readBasket(basketId, "id,session,status,mobile");
    expect(basket.mobile === customer.mobile).toBe(true);
    const details = await client.getOrderDetailsByNumber(String(basket.session));
    orders.push({ basketId, orderNumber: String(basket.session), productCode: details?.items[0]?.productCode ?? TEST_PRODUCT_CODE });
  }
  // Only order numbers -- no customer data.
  console.info(`Live test orders: ${orders.map((o) => `${o.orderNumber} (basket ${o.basketId})`).join(", ")}`);
});

afterAll(async () => {
  for (const order of orders) {
    try {
      await setStatus(order, S.CANCELED);
    } catch (err) {
      console.error(`Cleanup: could not cancel test order ${order.orderNumber}: ${(err as Error).message}`);
    }
  }
  if (productId && originalStock !== null) {
    const client = await getShopfaClient();
    const now = (await client.getProductByCode(TEST_PRODUCT_CODE))?.availableQuantity ?? null;
    if (now !== originalStock) {
      await shopfa("/api/shop/product/update", { id: productId, quantity: originalStock }, { id: productId });
      const restored = (await client.getProductByCode(TEST_PRODUCT_CODE))?.availableQuantity ?? null;
      console.info(`Test product stock changed ${originalStock} -> ${now}; restored to ${restored}`);
    }
  }
});

describe("LIVE Shopfa -- precheck branches", () => {
  it("all available, no siblings -> SENT_TO_POST", async () => {
    await given(S.PAYMENT_CONFIRMED);
    const res = await precheck(orders[0]!, true);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ saved: true, statusCode: S.SENT_TO_POST, warning: null });
    expect(await statusOf(orders[0]!)).toBe(S.SENT_TO_POST);
  });

  it("all available, every sibling ACCOUNTING_APPROVED -> all three SENT_TO_POST", async () => {
    await given(S.PAYMENT_CONFIRMED, S.ACCOUNTING_APPROVED, S.ACCOUNTING_APPROVED);
    const res = await precheck(orders[0]!, true);
    expect(res.body.data.statusCode).toBe(S.SENT_TO_POST);
    expect(res.body.data.relatedFailures).toEqual([]);
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber).sort()).toEqual(
      [orders[1]!.orderNumber, orders[2]!.orderNumber].sort(),
    );
    for (const order of orders) expect(await statusOf(order)).toBe(S.SENT_TO_POST);
  });

  it("all available, a sibling PAYMENT_DECLARED -> ACCOUNTING_APPROVED, siblings untouched", async () => {
    await given(S.PAYMENT_CONFIRMED, S.PAYMENT_DECLARED, S.ACCOUNTING_APPROVED);
    const res = await precheck(orders[0]!, true);
    expect(res.body.data.statusCode).toBe(S.ACCOUNTING_APPROVED);
    expect(await statusOf(orders[0]!)).toBe(S.ACCOUNTING_APPROVED);
    expect(await statusOf(orders[1]!)).toBe(S.PAYMENT_DECLARED);
    expect(await statusOf(orders[2]!)).toBe(S.ACCOUNTING_APPROVED);
  });

  it("all available, mixed siblings (READY_TO_SEND) -> READY_TO_SEND with the Shopfa-panel warning", async () => {
    await given(S.PAYMENT_CONFIRMED, S.READY_TO_SEND);
    const res = await precheck(orders[0]!, true);
    expect(res.body.data).toMatchObject({ statusCode: S.READY_TO_SEND, statusTitle: "آماده به ارسال", warning: "check_shopfa_panel" });
    expect(await statusOf(orders[0]!)).toBe(S.READY_TO_SEND);
    expect(await statusOf(orders[1]!)).toBe(S.READY_TO_SEND);
  });

  it("shortage with a sibling in SENT_TO_POST: asks first (nothing changes), then on confirm pulls it back", async () => {
    await given(S.PAYMENT_CONFIRMED, S.SENT_TO_POST, S.ACCOUNTING_APPROVED);
    const ask = await precheck(orders[0]!, false);
    expect(ask.body.data.saved).toBe(false);
    expect(ask.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([orders[1]!.orderNumber]);
    expect(await statusOf(orders[0]!)).toBe(S.PAYMENT_CONFIRMED);
    expect(await statusOf(orders[1]!)).toBe(S.SENT_TO_POST);

    const confirmed = await precheck(orders[0]!, false, true);
    expect(confirmed.body.data).toMatchObject({ saved: true, statusCode: S.WAREHOUSE_PROCESSING, relatedFailures: [] });
    expect(await statusOf(orders[0]!)).toBe(S.WAREHOUSE_PROCESSING);
    expect(await statusOf(orders[1]!)).toBe(S.ACCOUNTING_APPROVED);
    expect(await statusOf(orders[2]!)).toBe(S.ACCOUNTING_APPROVED);
    expect(parseOrderPrecheckUnavailableCodes(await noteOf(orders[0]!))).toEqual([orders[0]!.productCode]);
  });

  it("stock arrives: re-checking the shortage order releases it and its ACCOUNTING_APPROVED siblings to SENT_TO_POST", async () => {
    // Continues from the previous state: 8 / 10 / 10.
    const res = await precheck(orders[0]!, true);
    expect(res.body.data.statusCode).toBe(S.SENT_TO_POST);
    for (const order of orders) expect(await statusOf(order)).toBe(S.SENT_TO_POST);
    expect(parseOrderPrecheckUnavailableCodes(await noteOf(orders[0]!))).toBeNull();
  });

  it("the audit log recorded the precheck changes", async () => {
    const res = await request(app).get(`/api/order-history/${orders[0]!.orderNumber}`).set("Authorization", authHeader);
    const targets = res.body.data.statusChanges.map((c: { toStatusCode: number }) => c.toStatusCode);
    expect(targets).toEqual([S.SENT_TO_POST, S.SENT_TO_POST, S.ACCOUNTING_APPROVED, S.READY_TO_SEND, S.WAREHOUSE_PROCESSING, S.SENT_TO_POST]);
  });
});

describe("LIVE Shopfa -- packing", () => {
  it("builds the customer's group, shows the other-status order, and Save ships the group with the photo count in the note", async () => {
    await given(S.SENT_TO_POST, S.SENT_TO_POST, S.PAYMENT_DECLARED);
    const [a, b, other] = orders as [TestOrder, TestOrder, TestOrder];

    // Default (all-time) queue, as staff open it.
    const queue = await request(app).get("/api/packing/orders").set("Authorization", authHeader);
    expect(queue.status).toBe(200);
    const mine = queue.body.data.orders.filter((o: { orderNumber: string }) => [a.orderNumber, b.orderNumber].includes(o.orderNumber));
    expect(mine).toHaveLength(2);
    expect(mine[0].customerGroupKey === mine[1].customerGroupKey).toBe(true);
    // Contiguous in the queue so they're packed together.
    const positions = mine.map((o: { orderNumber: string }) =>
      queue.body.data.orders.findIndex((q: { orderNumber: string }) => q.orderNumber === o.orderNumber),
    );
    expect(Math.abs(positions[0] - positions[1])).toBe(1);

    const info = await request(app).get("/api/packing/customer-orders").query({ orderNumber: a.orderNumber }).set("Authorization", authHeader);
    expect(info.body.data.otherStatusOrders).toEqual([
      { orderNumber: other.orderNumber, statusCode: S.PAYMENT_DECLARED, statusTitle: "اعلام پرداخت" },
    ]);

    const sent = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field(
        "orders",
        JSON.stringify(
          mine.map((o: { orderNumber: string; externalOrderId: string; items: { productCode: string; title: string; quantity: number }[] }) => ({
            orderNumber: o.orderNumber,
            externalOrderId: o.externalOrderId,
            buyerName: null,
            items: o.items.map(({ productCode, title, quantity }) => ({ productCode, title, quantity })),
          })),
        ),
      )
      .attach("photos", Buffer.from("live-test-photo"), { filename: "live.jpg", contentType: "image/jpeg" });
    expect(sent.status).toBe(200);
    expect(sent.body.data.failed).toEqual([]);
    expect(sent.body.data.sent.map((o: { syncStatus: string }) => o.syncStatus)).toEqual([ShopfaSyncStatus.SYNCED, ShopfaSyncStatus.SYNCED]);

    for (const order of [a, b]) {
      expect(await statusOf(order)).toBe(S.SENT);
      expect(parsePackingPhotoCount(await noteOf(order))).toBe(1);
    }
    expect(await statusOf(other)).toBe(S.PAYMENT_DECLARED);

    const history = await request(app).get(`/api/order-history/${a.orderNumber}`).set("Authorization", authHeader);
    expect(history.body.data.statusChanges.at(-1)).toMatchObject({ toStatusCode: S.SENT, source: "packing" });
    expect(history.body.data.packings[0]).toMatchObject({ syncStatus: ShopfaSyncStatus.SYNCED, photoUrls: [expect.any(String)] });
  });

  it("a second save of an already-shipped order is idempotent: status stays SENT and the note keeps a single marker", async () => {
    const a = orders[0]!;
    const res = await request(app)
      .post("/api/packing/send")
      .set("Authorization", authHeader)
      .field("orders", JSON.stringify([{ orderNumber: a.orderNumber, externalOrderId: a.basketId, buyerName: null, items: [{ productCode: a.productCode, title: "x", quantity: 1 }] }]));
    expect(res.body.data.sent[0].syncStatus).toBe(ShopfaSyncStatus.SYNCED);
    const note = await noteOf(a);
    expect(parsePackingPhotoCount(note)).toBe(0);
    expect(note.split("بسته‌بندی - تعداد عکس").length - 1).toBe(1);
  });
});
