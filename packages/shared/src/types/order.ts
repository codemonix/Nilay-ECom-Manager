export interface ImportedOrderItemDTO {
  productCode: string;
  sku?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ImportedOrderBuyerDTO {
  externalBuyerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  mobile?: string;
  landline?: string;
  nationalId?: string;
}

/** An order imported from a Shopfa xlsx export -- see docs/architecture.md#shopfa-integration. */
export interface ImportedOrderDTO {
  id: string;
  externalOrderId: string;
  status: string;
  purchaseDate: string | null;
  paymentMethod?: string;
  paymentDate?: string;
  shippingMethod?: string;
  shippingCost: number;
  buyer: ImportedOrderBuyerDTO;
  cartWeight?: number;
  shipmentCode?: string;
  discountCode?: string;
  discountAmount: number;
  userMessage?: string;
  adminNote?: string;
  purchasePath?: string;
  items: ImportedOrderItemDTO[];
  itemsTotal: number;
  totalAmount: number;
  importedAt: string;
}

export interface ImportedOrderListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}
