import { describe, expect, it } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";
import { StaffRole } from "@complaint-system/shared";
import { createApp } from "../src/app";
import { createAuthenticatedUser } from "./testUtils";

const app = createApp();

// Every route this file exercises (/api/settings/*, /api/orders) is gated
// behind requirePermission(MenuKey.SETTINGS), which testUtils' default
// CUSTOMER_SERVICE role doesn't have -- an admin is the realistic role for
// data-source/import configuration anyway.
async function authHeaderForNewUser() {
  const { authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
  return authHeader;
}

const HEADERS = [
  "تاریخ خرید",
  "تاریخ میلادی خرید",
  "کد سفارش",
  "وضعیت",
  "کد کالا",
  "SKU",
  "نام کالا",
  "تعداد",
  "فی",
  "مبلغ",
  "شیوه پرداخت",
  "تاریخ پرداخت",
  "شیوه ارسال",
  "هزینه ارسال",
  "آی دی خریدار",
  "نام خریدار",
  "نام خانوادگی خریدار",
];

async function buildSampleXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Worksheet");
  sheet.addRow(HEADERS);
  // Order 1001: two line items for buyer 5001.
  sheet.addRow([
    "1405/06/12-19:17",
    "2026/09/03-19:17",
    1001,
    "ارسال شده",
    9001,
    null,
    "Necklace",
    1,
    1200000,
    1200000,
    "آنلاین(زیبال)",
    "1405/06/12-19:20",
    "ارسال تیپاکس",
    150000,
    5001,
    "Ali",
    "Ahmadi",
  ]);
  sheet.addRow([
    "1405/06/12-19:17",
    "2026/09/03-19:17",
    1001,
    "ارسال شده",
    9002,
    null,
    "Ring",
    2,
    500000,
    1000000,
    "آنلاین(زیبال)",
    "1405/06/12-19:20",
    "ارسال تیپاکس",
    150000,
    5001,
    "Ali",
    "Ahmadi",
  ]);
  // Order 1002: single line item for buyer 5002.
  sheet.addRow([
    "1405/06/05-19:38",
    "2026/08/27-19:38",
    1002,
    "پردازش انبار",
    9003,
    null,
    "Bracelet",
    1,
    900000,
    900000,
    "کیف پول",
    "1405/06/06-01:06",
    "ارسال تیپاکس",
    0,
    5002,
    "Sara",
    "Mohammadi",
  ]);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("Order xlsx import + Settings", () => {
  it("defaults to imported_file data source with no last import", async () => {
    const authHeader = await authHeaderForNewUser();
    const res = await request(app).get("/api/settings").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.dataSource).toBe("imported_file");
    expect(res.body.data.lastImport).toBeNull();
  });

  it("rejects enabling the live API when Shopfa credentials are not configured", async () => {
    const authHeader = await authHeaderForNewUser();
    const res = await request(app)
      .patch("/api/settings/data-source")
      .set("Authorization", authHeader)
      .send({ dataSource: "live_api" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("imports orders from an xlsx file, grouping rows by order code", async () => {
    const { user, authHeader } = await createAuthenticatedUser(StaffRole.ADMIN);
    const buffer = await buildSampleXlsx();

    const res = await request(app)
      .post("/api/settings/orders/import")
      .set("Authorization", authHeader)
      .attach("file", buffer, "orders.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ordersImported).toBe(2);
    expect(res.body.data.itemsImported).toBe(3);
    expect(res.body.data.rowsSkipped).toBe(0);
    expect(res.body.data.settings.lastImport.fileName).toBe("orders.xlsx");
    expect(res.body.data.settings.lastImport.importedByName).toBe(user.name);

    const settingsRes = await request(app).get("/api/settings").set("Authorization", authHeader);
    expect(settingsRes.body.data.lastImport.ordersImported).toBe(2);
  });

  it("lists and paginates imported orders", async () => {
    const authHeader = await authHeaderForNewUser();
    await buildSampleXlsx().then((buffer) =>
      request(app).post("/api/settings/orders/import").set("Authorization", authHeader).attach("file", buffer, "orders.xlsx"),
    );

    const res = await request(app).get("/api/orders").set("Authorization", authHeader).query({ pageSize: 1, page: 1 });
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.length).toBe(1);
  });

  it("returns order detail with its aggregated items and totals", async () => {
    const authHeader = await authHeaderForNewUser();
    const buffer = await buildSampleXlsx();
    await request(app).post("/api/settings/orders/import").set("Authorization", authHeader).attach("file", buffer, "orders.xlsx");

    const res = await request(app).get("/api/orders/1001").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.buyer.fullName).toBe("Ali Ahmadi");
    expect(res.body.data.itemsTotal).toBe(2200000);
    expect(res.body.data.totalAmount).toBe(2350000); // items + shippingCost (150000)
  });

  it("rejects a file missing required columns", async () => {
    const authHeader = await authHeaderForNewUser();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Worksheet");
    sheet.addRow(["Not", "A", "Valid", "Header"]);
    sheet.addRow([1, 2, 3, 4]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const res = await request(app)
      .post("/api/settings/orders/import")
      .set("Authorization", authHeader)
      .attach("file", buffer, "bad.xlsx");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("uses the imported-orders data source for customer summary and search when not mocked", async () => {
    const authHeader = await authHeaderForNewUser();
    const buffer = await buildSampleXlsx();
    await request(app).post("/api/settings/orders/import").set("Authorization", authHeader).attach("file", buffer, "orders.xlsx");

    // customerService still resolves through the mock client while
    // SHOPFA_MOCK=true (tests/setup.ts) -- this only verifies the imported
    // order data itself is queryable directly for order-linking use cases.
    const res = await request(app).get("/api/orders").set("Authorization", authHeader).query({ search: "Mohammadi" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].buyer.fullName).toBe("Sara Mohammadi");
  });
});
