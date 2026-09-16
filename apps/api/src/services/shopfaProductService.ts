import type { MatchPreviewDTO } from "@complaint-system/shared";
import { getShopfaClient } from "../integrations/shopfa";
import { shopfaTitleEndsWithAsterisk } from "../integrations/shopfa/shopfaTitle";

/**
 * Free-text product search for Match & Register's "search by name and pick
 * from a list" flow -- an alternative to entering an exact Shopfa code.
 * Results are shaped identically to packageService.previewMatch's output so
 * picking one from the list can populate the same confirm-match UI state.
 */
export async function searchProducts(query: string): Promise<MatchPreviewDTO[]> {
  const client = await getShopfaClient();
  const results = await client.searchProducts(query);
  return results.map((lookup) => ({
    shopfaProductId: lookup.shopfaProductId,
    productCode: lookup.productCode,
    title: lookup.title,
    sku: lookup.sku,
    price: lookup.price,
    imageUrl: lookup.imageUrl ?? null,
    titleEndsWithAsterisk: shopfaTitleEndsWithAsterisk(lookup.title),
    availableQuantity: lookup.availableQuantity,
  }));
}
