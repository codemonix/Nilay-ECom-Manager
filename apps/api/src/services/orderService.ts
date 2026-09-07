import type { ImportedOrderDTO } from "@complaint-system/shared";
import { importedOrderRepository } from "../repositories/importedOrderRepository";
import type { ImportedOrderDocument } from "../models/ImportedOrder";
import type { ListOrdersQuery } from "../validators/orderValidators";
import { ApiError } from "../utils/ApiError";

export function serializeImportedOrder(doc: ImportedOrderDocument): ImportedOrderDTO {
  const buyer = doc.buyer;
  return {
    id: String(doc._id),
    externalOrderId: doc.externalOrderId,
    status: doc.status,
    purchaseDate: doc.purchaseDate ? doc.purchaseDate.toISOString() : null,
    paymentMethod: doc.paymentMethod ?? undefined,
    paymentDate: doc.paymentDate ?? undefined,
    shippingMethod: doc.shippingMethod ?? undefined,
    shippingCost: doc.shippingCost,
    buyer: {
      externalBuyerId: buyer.externalBuyerId,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      fullName: [buyer.firstName, buyer.lastName].filter(Boolean).join(" ").trim() || buyer.externalBuyerId,
      province: buyer.province ?? undefined,
      city: buyer.city ?? undefined,
      address: buyer.address ?? undefined,
      postalCode: buyer.postalCode ?? undefined,
      mobile: buyer.mobile ?? undefined,
      landline: buyer.landline ?? undefined,
      nationalId: buyer.nationalId ?? undefined,
    },
    cartWeight: doc.cartWeight ?? undefined,
    shipmentCode: doc.shipmentCode ?? undefined,
    discountCode: doc.discountCode ?? undefined,
    discountAmount: doc.discountAmount,
    userMessage: doc.userMessage ?? undefined,
    adminNote: doc.adminNote ?? undefined,
    purchasePath: doc.purchasePath ?? undefined,
    items: doc.items.map((item) => ({
      productCode: item.productCode,
      sku: item.sku ?? undefined,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    itemsTotal: doc.itemsTotal,
    totalAmount: doc.totalAmount,
    importedAt: doc.importedAt.toISOString(),
  };
}

export async function listImportedOrders(query: ListOrdersQuery) {
  const { items, total } = await importedOrderRepository.list(query);
  return {
    items: items.map(serializeImportedOrder),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getImportedOrder(externalOrderId: string): Promise<ImportedOrderDTO> {
  const doc = await importedOrderRepository.findByExternalOrderId(externalOrderId);
  if (!doc) throw ApiError.notFound("Order not found");
  return serializeImportedOrder(doc);
}
