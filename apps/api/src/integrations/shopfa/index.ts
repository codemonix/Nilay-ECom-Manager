import { DataSource } from "@complaint-system/shared";
import { env } from "../../config/env";
import { settingsRepository } from "../../repositories/settingsRepository";
import type { ShopfaClient } from "./shopfaTypes";
import { MockShopfaClient } from "./mockShopfaClient";
import { HttpShopfaClient } from "./shopfaClient";
import { ImportedOrdersShopfaClient } from "./importedOrdersShopfaClient";

let mockClient: ShopfaClient | undefined;
let httpClient: ShopfaClient | undefined;
let importedClient: ShopfaClient | undefined;

/**
 * Returns the Shopfa client to use for this request. When SHOPFA_MOCK is
 * set (local dev / tests), always returns the static in-memory mock.
 * Otherwise the choice is the runtime Settings.dataSource toggle exposed on
 * the Settings page: "live_api" talks to the real Shopfa HTTP API,
 * "imported_file" (the default until Shopfa API credentials exist) reads
 * from orders imported via xlsx. This is why the function is async -- the
 * setting lives in MongoDB, not an env var, so it can be flipped from the
 * UI without a server restart. Never call the client classes directly
 * outside this factory.
 */
export async function getShopfaClient(): Promise<ShopfaClient> {
  if (env.SHOPFA_MOCK) {
    return (mockClient ??= new MockShopfaClient());
  }

  const settings = await settingsRepository.getOrCreate();
  if (settings.dataSource === DataSource.LIVE_API) {
    return (httpClient ??= new HttpShopfaClient(env.SHOPFA_API_BASE_URL, env.SHOPFA_API_TOKEN));
  }
  return (importedClient ??= new ImportedOrdersShopfaClient());
}

export type { ShopfaClient } from "./shopfaTypes";
