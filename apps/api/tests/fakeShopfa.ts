import { SHOPFA_ORDER_STATUS_OPTIONS } from "@complaint-system/shared";
import { ApiError } from "../src/utils/ApiError";
import type {
  ShopfaCustomerOrderRef,
  ShopfaOrderDateWindow,
  ShopfaPackingOrder,
} from "../src/integrations/shopfa/shopfaTypes";

/**
 * A stateful in-memory stand-in for the Shopfa order API -- only the methods
 * Order Precheck, Packing and the packing sync touch. Unlike per-test vi.fn
 * mocks, status writes really change the stored order, so a test can drive
 * the status machine through several steps and assert on the end state.
 * Failures are injected per method with failNext().
 */
export interface FakeOrder {
  externalOrderId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerMobile: string | null;
  statusCode: number;
  note: string;
  shippingMethod: string | null;
  orderDate: Date | null;
  paymentDate: Date | null;
  items: { productCode: string; title: string; imageUrl: string | null; quantity: number }[];
}

type FailureKind = "unreachable" | "not_applied";
type WriteMethod = "updateOrderNoteAndStatus" | "updateOrderStatus" | "getOrderAdminNote" | "findOrdersByCustomerQuery";

const titleFor = (code: number) => SHOPFA_ORDER_STATUS_OPTIONS.find((o) => o.code === code)?.statusTitle ?? String(code);
const digits = (value: string | null) => (value ?? "").replace(/\D/g, "");

export class FakeShopfa {
  orders = new Map<string, FakeOrder>();
  /** Every status write that actually applied, in order. */
  statusWrites: { orderNumber: string; statusCode: number }[] = [];
  private failures: { method: WriteMethod; kind: FailureKind; remaining: number }[] = [];
  private nextId = 1;

  reset(): void {
    this.orders.clear();
    this.statusWrites = [];
    this.failures = [];
    this.nextId = 1;
  }

  add(order: Partial<FakeOrder> & { orderNumber: string; statusCode: number }): FakeOrder {
    const full: FakeOrder = {
      externalOrderId: String(this.nextId++),
      buyerName: "Sara Karimi",
      buyerMobile: "09121112233",
      note: "",
      shippingMethod: "پست پیشتاز",
      orderDate: new Date("2026-09-01T10:00:00Z"),
      paymentDate: new Date("2026-09-01T10:00:00Z"),
      items: [{ productCode: "7724765", title: "Test item", imageUrl: null, quantity: 1 }],
      ...order,
    };
    this.orders.set(full.orderNumber, full);
    return full;
  }

  status(orderNumber: string): number | undefined {
    return this.orders.get(orderNumber)?.statusCode;
  }

  note(orderNumber: string): string | undefined {
    return this.orders.get(orderNumber)?.note;
  }

  /** The next `times` calls of `method` fail: "unreachable" throws like a Shopfa outage, "not_applied" answers but leaves the order unchanged. */
  failNext(method: WriteMethod, times = 1, kind: FailureKind = "unreachable"): void {
    this.failures.push({ method, kind, remaining: times });
  }

  private takeFailure(method: WriteMethod): FailureKind | null {
    const failure = this.failures.find((f) => f.method === method && f.remaining > 0);
    if (!failure) return null;
    failure.remaining -= 1;
    if (failure.kind === "unreachable") throw ApiError.badGateway("Failed to reach Shopfa order service");
    return failure.kind;
  }

  private ref(order: FakeOrder): ShopfaCustomerOrderRef {
    return {
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerMobile: order.buyerMobile,
      statusCode: order.statusCode,
      statusTitle: titleFor(order.statusCode),
    };
  }

  private applyStatus(order: FakeOrder, statusCode: number): void {
    order.statusCode = statusCode;
    this.statusWrites.push({ orderNumber: order.orderNumber, statusCode });
  }

  readonly client = {
    getOrderAdminNote: async (orderNumber: string) => {
      this.takeFailure("getOrderAdminNote");
      const order = this.orders.get(orderNumber);
      return order ? { externalOrderId: order.externalOrderId, orderNumber, note: order.note } : null;
    },
    getOrderDetailsByNumber: async (orderNumber: string) => {
      const order = this.orders.get(orderNumber);
      return order ? { ...order, statusTitle: titleFor(order.statusCode) } : null;
    },
    /** Substring match on buyer name or mobile digits, like Shopfa's `search=`. */
    findOrdersByCustomerQuery: async (query: string) => {
      this.takeFailure("findOrdersByCustomerQuery");
      const q = query.trim().toLowerCase();
      const qDigits = digits(query).replace(/^98/, "0");
      return [...this.orders.values()]
        .filter(
          (order) =>
            (order.buyerName ?? "").toLowerCase().includes(q) ||
            (qDigits.length > 0 && digits(order.buyerMobile).replace(/^98/, "0").includes(qDigits)),
        )
        .map((order) => this.ref(order));
    },
    updateOrderNoteAndStatus: async (orderNumber: string, update: { note: string; statusCode: number }) => {
      const failure = this.takeFailure("updateOrderNoteAndStatus");
      const order = this.orders.get(orderNumber);
      if (!order) return null;
      if (failure !== "not_applied") {
        order.note = update.note;
        this.applyStatus(order, update.statusCode);
      }
      return {
        externalOrderId: order.externalOrderId,
        orderNumber,
        note: order.note,
        statusCode: order.statusCode,
        statusTitle: titleFor(order.statusCode),
      };
    },
    updateOrderStatus: async (orderNumber: string, statusCode: number) => {
      const failure = this.takeFailure("updateOrderStatus");
      const order = this.orders.get(orderNumber);
      if (!order) return null;
      if (failure !== "not_applied") this.applyStatus(order, statusCode);
      return { orderNumber, statusCode: order.statusCode, statusTitle: titleFor(order.statusCode) };
    },
    listOrdersByStatusForPrecheck: async (statusCodes: number[]) =>
      [...this.orders.values()]
        .filter((order) => statusCodes.includes(order.statusCode))
        .map((order) => ({ ...order, statusTitle: titleFor(order.statusCode) })),
    listOrdersByStatusForPacking: async (
      statusCode: number,
      _range: ShopfaOrderDateWindow | null,
    ): Promise<ShopfaPackingOrder[]> =>
      [...this.orders.values()]
        .filter((order) => order.statusCode === statusCode)
        .map((order) => ({ ...order, shippingMethodId: null, statusTitle: titleFor(order.statusCode) })),
    countOrdersInStatus: async (statusCode: number) =>
      [...this.orders.values()].filter((order) => order.statusCode === statusCode).length,
  };
}

export const fakeShopfa = new FakeShopfa();
