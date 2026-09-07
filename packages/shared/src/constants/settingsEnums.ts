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
