import type { VersionInfoDTO } from "@complaint-system/shared";

/**
 * The version of this web bundle, baked in at build time (see
 * vite.config.ts and the "Versioning" section of the README). The API
 * reports its own through GET /api/version; the two only differ while a
 * browser is still running a bundle cached from before a deploy.
 */
export const APP_VERSION: VersionInfoDTO =
  typeof __APP_VERSION_INFO__ === "undefined"
    ? { version: "unknown", commit: "", buildDate: "" }
    : __APP_VERSION_INFO__;
