import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { StaffRole } from "@complaint-system/shared";
import { createAuthenticatedUser } from "./testUtils";

const getOrderAdminNote = vi.fn();
const getOrderDetailsByNumber = vi.fn();
const findOrdersByCustomerQuery = vi.fn();
const updateOrderNoteAndStatus = vi.fn();
const updateOrderStatus = vi.fn();

vi.mock("../src/integrations/shopfa", () => ({
  getShopfaClient: async () => ({
    getOrderAdminNote,
    getOrderDetailsByNumber,
    findOrdersByCustomerQuery,
    updateOrderNoteAndStatus,
    updateOrderStatus,
  }),
}));

const { createApp } = await import("../src/app");
const app = createApp();

const STATUS_TITLES: Record<number, string> = {
  4: "پرداخت تائيد شده",
  5: "ارسال شده",
  8: "پردازش انبار",
  9: "اعلام پرداخت",
  10: "تایید حسابداری",
  13: "ارسال شده به سرویس پستی",
};

const other = (orderNumber: string, statusCode: number, mobile = "09121112233", name = "Sara") => ({
  orderNumber,
  buyerName: name,
  buyerMobile: mobile,
  statusCode,
  statusTitle: STATUS_TITLES[statusCode] ?? String(statusCode),
});

async function save(available: boolean[], confirmStatusChanges?: boolean) {
  const { authHeader } = await createAuthenticatedUser(StaffRole.WAREHOUSE);
  return request(app)
    .post("/api/order-precheck/orders/100/save")
    .set("Authorization", authHeader)
    .send({
      items: available.map((ok, i) => ({ productCode: `P${i}`, available: ok })),
      ...(confirmStatusChanges === undefined ? {} : { confirmStatusChanges }),
    });
}

describe("Order Precheck save -- rules involving the same customer's other orders", () => {
  beforeEach(() => {
    for (const fn of [getOrderAdminNote, getOrderDetailsByNumber, findOrdersByCustomerQuery, updateOrderNoteAndStatus, updateOrderStatus]) {
      fn.mockReset();
    }
    getOrderAdminNote.mockResolvedValue({ externalOrderId: "1", orderNumber: "100", note: "" });
    getOrderDetailsByNumber.mockResolvedValue({ orderNumber: "100", buyerName: "Sara", buyerMobile: "+98 912 111 2233" });
    updateOrderNoteAndStatus.mockImplementation(async (orderNumber: string, update: { statusCode: number }) => ({
      externalOrderId: "1",
      orderNumber,
      note: "",
      statusCode: update.statusCode,
      statusTitle: STATUS_TITLES[update.statusCode],
    }));
    updateOrderStatus.mockImplementation(async (orderNumber: string, statusCode: number) => ({
      orderNumber,
      statusCode,
      statusTitle: STATUS_TITLES[statusCode],
    }));
  });

  it("all items available + another order of the customer still pending (4/8/9) -> this order waits in accounting-confirmed (10)", async () => {
    for (const pending of [4, 8, 9]) {
      updateOrderNoteAndStatus.mockClear();
      findOrdersByCustomerQuery.mockResolvedValueOnce([other("200", pending), other("201", 10)]);
      const res = await save([true, true]);
      expect(res.status).toBe(200);
      expect(res.body.data.saved).toBe(true);
      expect(updateOrderNoteAndStatus).toHaveBeenCalledWith("100", expect.objectContaining({ statusCode: 10 }));
      expect(res.body.data.relatedOrders).toEqual([]);
    }
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("all items available + the customer's other orders are all in accounting-confirmed -> every order goes to postal service (13)", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([
      other("200", 10),
      other("201", 10),
      other("202", 5), // already shipped: ignored
      other("203", 4, "09990000000", "Someone Else"), // different customer: ignored
    ]);
    const res = await save([true]);
    expect(updateOrderNoteAndStatus).toHaveBeenCalledWith("100", expect.objectContaining({ statusCode: 13 }));
    expect(updateOrderStatus).toHaveBeenCalledTimes(2);
    expect(updateOrderStatus).toHaveBeenCalledWith("200", 13);
    expect(updateOrderStatus).toHaveBeenCalledWith("201", 13);
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["200", "201"]);
  });

  it("all items available + no other orders at all -> postal service (13), as before", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([]);
    const res = await save([true]);
    expect(res.body.data.statusCode).toBe(13);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("shortage + the customer has orders already sent to postal service -> asks for confirmation first and changes NOTHING", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([other("200", 13), other("201", 13), other("202", 10)]);
    const res = await save([true, false]);
    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(false);
    expect(res.body.data.relatedOrders).toEqual([
      { orderNumber: "200", fromStatusTitle: STATUS_TITLES[13], toStatusCode: 10, toStatusTitle: STATUS_TITLES[10] },
      { orderNumber: "201", fromStatusTitle: STATUS_TITLES[13], toStatusCode: 10, toStatusTitle: STATUS_TITLES[10] },
    ]);
    expect(updateOrderNoteAndStatus).not.toHaveBeenCalled();
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("shortage + confirmed -> this order goes to warehouse processing (8) and the customer's postal-service orders go back to accounting-confirmed (10)", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([other("200", 13), other("202", 10)]);
    const res = await save([false], true);
    expect(res.body.data.saved).toBe(true);
    expect(updateOrderNoteAndStatus).toHaveBeenCalledWith("100", expect.objectContaining({ statusCode: 8 }));
    expect(updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(updateOrderStatus).toHaveBeenCalledWith("200", 10);
  });

  it("shortage + no order of the customer in postal service -> saved straight away to 8, no confirmation needed", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([other("200", 10), other("201", 8)]);
    const res = await save([false]);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.statusCode).toBe(8);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("reports a failed related status change without undoing the saved order", async () => {
    findOrdersByCustomerQuery.mockResolvedValueOnce([other("200", 10), other("201", 10)]);
    updateOrderStatus.mockImplementationOnce(async () => null); // 200 not found
    const res = await save([true]);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.relatedOrders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["201"]);
    expect(res.body.data.relatedFailures).toEqual([{ orderNumber: "200", message: "Order not found" }]);
  });

  it("matches a customer without a mobile number by name", async () => {
    getOrderDetailsByNumber.mockResolvedValue({ orderNumber: "100", buyerName: "Reza Ahmadi", buyerMobile: null });
    findOrdersByCustomerQuery.mockResolvedValueOnce([
      other("200", 8, "", "reza  ahmadi"),
      other("201", 8, "", "Someone Else"),
    ]);
    const res = await save([true]);
    expect(findOrdersByCustomerQuery).toHaveBeenCalledWith("ahmadi");
    expect(res.body.data.statusCode).toBe(10); // matched the pending order of the same name
  });
});
