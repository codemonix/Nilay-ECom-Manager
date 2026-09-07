import axios from "axios";
import type { ShopfaConnectionTestResultDTO } from "@complaint-system/shared";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

/**
 * Checks that the app can actually reach *and authenticate against* Shopfa,
 * independent of SHOPFA_MOCK or the Settings.dataSource toggle (which only
 * affect which client customer/order lookups go through). Two checks, both
 * read-only and safe to call at any time:
 *
 * 1. POST /api/system/info -- account-agnostic and needs no credential, so
 *    it only proves the base URL/domain is reachable.
 * 2. POST /api/user/users?private_key=...&limit=1 -- Shopfa reads its
 *    `private_key` auth from the query string, not an Authorization header
 *    (confirmed live -- a header-based token is silently ignored and every
 *    authenticated endpoint fails). Checking this too is what actually
 *    proves the configured token works, since step 1 alone would report
 *    "ok" even with a completely broken or missing credential.
 *
 * Never throws; failures come back as `{ ok: false, message }` so the
 * Settings page can render them directly.
 */
export async function testShopfaConnection(): Promise<ShopfaConnectionTestResultDTO> {
  if (!env.SHOPFA_API_BASE_URL || !env.SHOPFA_API_TOKEN) {
    return {
      ok: false,
      message: "SHOPFA_API_BASE_URL / SHOPFA_API_TOKEN are not configured on the server.",
    };
  }

  let shop: { title?: string; domain?: string; url?: string } | undefined;
  try {
    const { data, status } = await axios.post(
      `${env.SHOPFA_API_BASE_URL}/api/system/info`,
      {},
      { timeout: 10_000, validateStatus: () => true },
    );

    if (!(status >= 200 && status < 300 && data?.successful !== false)) {
      return {
        ok: false,
        httpStatus: status,
        message: data?.error || `Shopfa responded with an unexpected status (${status}).`,
        raw: data,
      };
    }
    shop = { title: data?.title, domain: data?.domain, url: data?.url };
  } catch (err) {
    logger.error("Shopfa connection test (system/info) failed", { err });
    return { ok: false, message: axios.isAxiosError(err) ? err.message : "Failed to reach Shopfa." };
  }

  try {
    const { data, status } = await axios.post(
      `${env.SHOPFA_API_BASE_URL}/api/user/users`,
      {},
      { params: { private_key: env.SHOPFA_API_TOKEN, limit: 1 }, timeout: 10_000, validateStatus: () => true },
    );

    if (status >= 200 && status < 300) {
      return { ok: true, httpStatus: status, message: "Connected and authenticated successfully.", shop, raw: data };
    }
    return {
      ok: false,
      httpStatus: status,
      message: `Reached the shop, but the API token was rejected: ${data?.error ?? "unknown error"} (code ${data?.error_code ?? "?"}).`,
      shop,
      raw: data,
    };
  } catch (err) {
    logger.error("Shopfa connection test (auth check) failed", { err });
    return {
      ok: false,
      message: axios.isAxiosError(err) ? `Reached the shop, but the auth check failed: ${err.message}` : "Failed to reach Shopfa.",
      shop,
    };
  }
}
