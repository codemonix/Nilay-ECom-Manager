/**
 * Where order/customer data currently comes from. "imported_file" reads
 * from orders imported via an xlsx upload (Settings page); "live_api" talks
 * to the real Shopfa HTTP API. Toggled at runtime from the Settings page --
 * see docs/architecture.md#shopfa-integration.
 */
export const DataSource = {
  IMPORTED_FILE: "imported_file",
  LIVE_API: "live_api",
} as const;
export type DataSource = (typeof DataSource)[keyof typeof DataSource];
export const DATA_SOURCE_VALUES = Object.values(DataSource);

/**
 * Admin-configurable session lifetimes (Settings page -> Session). The
 * access token is the short-lived JWT sent on every request; the refresh
 * token is the long-lived, httpOnly-cookie credential used to mint new
 * access tokens. Each refresh rotates the refresh token and restarts its
 * lifetime, so refreshTokenTtlDays is effectively "sign out after this many
 * days of inactivity". Changes apply to tokens issued afterwards.
 */
export const SESSION_TTL_LIMITS = {
  accessTokenTtlMinutes: { min: 1, max: 1440, default: 15 },
  refreshTokenTtlDays: { min: 1, max: 365, default: 30 },
} as const;
