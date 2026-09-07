import ExcelJS from "exceljs";
import type { ImportOrdersResultDTO } from "@complaint-system/shared";
import { importedOrderRepository, type UpsertOrderData } from "../repositories/importedOrderRepository";
import { settingsRepository } from "../repositories/settingsRepository";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import * as settingsService from "./settingsService";

/**
 * Maps the Farsi column headers of a Shopfa order xlsx export to logical
 * field names. Looked up by header text (not column position) so a
 * reordered export still imports correctly. See docs/architecture.md for
 * why this is the boundary between "Shopfa's export format" and our schema.
 */
const COLUMN_MAP: Record<string, string> = {
  "کد سفارش": "orderCode",
  وضعیت: "status",
  "تاریخ میلادی خرید": "purchaseDateGregorian",
  "کد کالا": "productCode",
  SKU: "sku",
  "نام کالا": "title",
  تعداد: "quantity",
  فی: "unitPrice",
  مبلغ: "amount",
  "شیوه پرداخت": "paymentMethod",
  "تاریخ پرداخت": "paymentDate",
  "شیوه ارسال": "shippingMethod",
  "هزینه ارسال": "shippingCost",
  "آی دی خریدار": "buyerId",
  "نام خریدار": "buyerFirstName",
  "نام خانوادگی خریدار": "buyerLastName",
  استان: "province",
  شهرستان: "city",
  نشانی: "address",
  "کد پستی": "postalCode",
  "تلفن همراه": "mobile",
  "تلفن ثابت": "landline",
  "کد ملی": "nationalId",
  "وزن سبد": "cartWeight",
  "کد مرسوله": "shipmentCode",
  "کد تخفیف": "discountCode",
  "مبلغ تخفیف": "discountAmount",
  "پیغام کاربر": "userMessage",
  "یادداشت مدیر": "adminNote",
  "مسیر خرید": "purchasePath",
};

const REQUIRED_FIELDS = ["orderCode", "status", "productCode", "title", "quantity", "buyerId"];
const MAX_SKIPPED_SAMPLES = 20;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return cellText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("text" in value) return String((value as ExcelJS.CellHyperlinkValue).text ?? "");
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    }
  }
  return String(value).trim();
}

function toNum(value: ExcelJS.CellValue): number {
  const str = cellText(value);
  if (!str) return 0;
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

/** Parses Shopfa's Gregorian export format "YYYY/MM/DD-HH:mm" into a Date, or null if unparseable. */
function parseShopfaDate(value: ExcelJS.CellValue): Date | null {
  const str = cellText(value);
  const match = /^(\d{4})\/(\d{2})\/(\d{2})-(\d{2}):(\d{2})$/.exec(str);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importXlsxFile(
  buffer: Buffer,
  originalFilename: string,
  actor: { id: string } | undefined,
): Promise<ImportOrdersResultDTO> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw ApiError.badRequest("Could not read the uploaded file as an Excel workbook (.xlsx)");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw ApiError.badRequest("The uploaded workbook has no worksheets");

  const headerRow = sheet.getRow(1);
  const fieldColumns = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const field = COLUMN_MAP[cellText(cell.value).trim()];
    if (field) fieldColumns.set(field, colNumber);
  });

  const missing = REQUIRED_FIELDS.filter((f) => !fieldColumns.has(f));
  if (missing.length > 0) {
    throw ApiError.badRequest(
      `The uploaded file is missing required columns: ${missing.join(", ")}. Make sure this is an unmodified Shopfa order export.`,
    );
  }

  const get = (row: ExcelJS.Row, field: string): ExcelJS.CellValue => {
    const col = fieldColumns.get(field);
    return col ? row.getCell(col).value : null;
  };

  const ordersByCode = new Map<string, UpsertOrderData>();
  let rowsSkipped = 0;
  let rowsProcessed = 0;
  const skippedSamples: Array<{ row: number; reason: string }> = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const orderCode = cellText(get(row, "orderCode"));
    const buyerId = cellText(get(row, "buyerId"));
    const productCode = cellText(get(row, "productCode"));
    const title = cellText(get(row, "title"));
    const quantity = toNum(get(row, "quantity"));

    if (!orderCode || !buyerId || !productCode || !title || quantity <= 0) {
      rowsSkipped += 1;
      if (skippedSamples.length < MAX_SKIPPED_SAMPLES) {
        skippedSamples.push({ row: rowNumber, reason: "Missing required order/item fields" });
      }
      continue;
    }
    rowsProcessed += 1;

    let order = ordersByCode.get(orderCode);
    if (!order) {
      order = {
        externalOrderId: orderCode,
        status: cellText(get(row, "status")) || "unknown",
        purchaseDate: parseShopfaDate(get(row, "purchaseDateGregorian")),
        paymentMethod: cellText(get(row, "paymentMethod")) || undefined,
        paymentDate: cellText(get(row, "paymentDate")) || undefined,
        shippingMethod: cellText(get(row, "shippingMethod")) || undefined,
        shippingCost: toNum(get(row, "shippingCost")),
        buyer: {
          externalBuyerId: buyerId,
          firstName: cellText(get(row, "buyerFirstName")),
          lastName: cellText(get(row, "buyerLastName")),
          province: cellText(get(row, "province")) || undefined,
          city: cellText(get(row, "city")) || undefined,
          address: cellText(get(row, "address")) || undefined,
          postalCode: cellText(get(row, "postalCode")) || undefined,
          mobile: cellText(get(row, "mobile")) || undefined,
          landline: cellText(get(row, "landline")) || undefined,
          nationalId: cellText(get(row, "nationalId")) || undefined,
        },
        cartWeight: toNum(get(row, "cartWeight")) || undefined,
        shipmentCode: cellText(get(row, "shipmentCode")) || undefined,
        discountCode: cellText(get(row, "discountCode")) || undefined,
        discountAmount: toNum(get(row, "discountAmount")),
        userMessage: cellText(get(row, "userMessage")) || undefined,
        adminNote: cellText(get(row, "adminNote")) || undefined,
        purchasePath: cellText(get(row, "purchasePath")) || undefined,
        items: [],
        itemsTotal: 0,
        totalAmount: 0,
      };
      ordersByCode.set(orderCode, order);
    }

    const unitPrice = toNum(get(row, "unitPrice"));
    const amount = toNum(get(row, "amount")) || unitPrice * quantity;
    order.items.push({
      productCode,
      sku: cellText(get(row, "sku")) || undefined,
      title,
      quantity,
      unitPrice,
      amount,
    });
  }

  if (ordersByCode.size === 0) {
    throw ApiError.badRequest("No valid order rows were found in the uploaded file");
  }

  const orders = Array.from(ordersByCode.values()).map((order) => {
    const itemsTotal = order.items.reduce((sum, item) => sum + item.amount, 0);
    return {
      ...order,
      itemsTotal,
      totalAmount: itemsTotal + order.shippingCost - order.discountAmount,
    };
  });

  const importedAt = new Date();
  await importedOrderRepository.upsertMany(orders, importedAt);

  const itemsImported = orders.reduce((sum, order) => sum + order.items.length, 0);

  await settingsRepository.recordImport({
    fileName: originalFilename,
    importedAt,
    importedBy: actor?.id ?? null,
    rowsProcessed,
    rowsSkipped,
    ordersImported: orders.length,
    itemsImported,
  });

  logger.info("Orders xlsx import completed", {
    fileName: originalFilename,
    rowsProcessed,
    rowsSkipped,
    ordersImported: orders.length,
    itemsImported,
  });

  const settings = await settingsService.getSettings();
  return {
    rowsProcessed,
    rowsSkipped,
    ordersImported: orders.length,
    itemsImported,
    skippedSamples,
    settings,
  };
}
