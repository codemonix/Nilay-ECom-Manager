import { env } from "./env";
import { createRedactor } from "../utils/redact";

/**
 * The app-wide redactor, primed with the configured secrets. Used by the
 * winston pipeline (config/logger.ts) and by every service that persists
 * request-derived text to the database (activity and Shopfa transaction logs).
 */
export const redactor = createRedactor([env.JWT_SECRET, env.SHOPFA_API_TOKEN]);
