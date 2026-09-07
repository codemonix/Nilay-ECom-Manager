import { env } from "../../config/env";
import type { ShopfaClient } from "./shopfaTypes";
import { MockShopfaClient } from "./mockShopfaClient";
import { HttpShopfaClient } from "./shopfaClient";

let client: ShopfaClient | undefined;

/** Returns the singleton Shopfa client, chosen by SHOPFA_MOCK. Never call the two client classes directly outside this factory. */
export function getShopfaClient(): ShopfaClient {
  if (!client) {
    client = env.SHOPFA_MOCK
      ? new MockShopfaClient()
      : new HttpShopfaClient(env.SHOPFA_API_BASE_URL, env.SHOPFA_API_TOKEN);
  }
  return client;
}

export type { ShopfaClient } from "./shopfaTypes";
