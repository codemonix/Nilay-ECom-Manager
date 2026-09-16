import type { PackageEventType, PackageStatus } from "../constants/packageEnums";

export interface PackageItemDTO {
  id: string;
  photoAttachmentId: string | null;
  description: string;
  /** Free-text variant label, e.g. a ring/bangle size -- each variant is its own item row with its own photo/quantity/price/match. */
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;

  productCode: string | null;
  shopfaProductId: string | null;
  sku: string | null;
  matchedProductTitle: string | null;
  matchedProductImageUrl: string | null;
  /** Whether the matched Shopfa title ends with "*" -- a convention the (not yet built) Inventory module will act on. */
  titleEndsWithAsterisk: boolean;
  /** True once matched, until the Inventory module decides whether/how to update Shopfa's stock level or title. */
  inventoryPending: boolean;
  matchedAt: string | null;
  matchedBy: string | null;
  /** Shopfa's own stock count as of the moment this item was matched -- captured so the UI can suggest what Shopfa's count should be updated to (this snapshot + the quantity received), since nothing writes that back to Shopfa automatically yet. Null when the match's data source couldn't report a quantity. */
  matchedAvailableQuantity: number | null;

  /** Actual count confirmed by the Receiving module once the package arrives at its destination; null until then. */
  receivedQuantity: number | null;

  loggedAt: string;
  loggedBy: string | null;
  notes: string | null;
}

export interface PackageDTO {
  id: string;
  packageNumber: string;
  status: PackageStatus;
  supplierName: string | null;
  items: PackageItemDTO[];
  createdBy: { id: string; name: string } | null;
  receivedAt: string | null;
  receivedBy: { id: string; name: string } | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageEventDTO {
  id: string;
  packageId: string;
  type: PackageEventType;
  actor: { id: string; name: string } | null;
  body: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface PackageListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PackageStatus;
  sortBy?: "createdAt" | "lastActivityAt" | "packageNumber";
  sortDir?: "asc" | "desc";
}

export interface ReceiveItemPayload {
  description?: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface MatchItemPayload {
  productCode: string;
}

/** Read-only lookup result shown to the user before they confirm a Shopfa code match. */
export interface MatchPreviewDTO {
  shopfaProductId: string;
  productCode: string;
  title: string;
  sku: string | null;
  price: number;
  imageUrl: string | null;
  titleEndsWithAsterisk: boolean;
  /** Current stock count on Shopfa; null when the active data source can't provide it. */
  availableQuantity: number | null;
}
