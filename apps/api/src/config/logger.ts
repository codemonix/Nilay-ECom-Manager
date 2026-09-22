import winston from "winston";
import { env } from "./env";
import { MongoLogTransport } from "./mongoLogTransport";
import { redactor } from "./redactor";

/**
 * Runs first in the pipeline, so every transport (console and
 * MongoLogTransport) only ever sees scrubbed data: secret-named keys are
 * masked, secret-looking substrings (query-string tokens, Bearer/JWT
 * values, URL credentials, the literal configured secrets) are replaced,
 * and Error objects are reduced to a safe subset (never axios's full
 * request config, which carries the Shopfa `private_key`).
 */
const redactSecrets = winston.format((info) => {
  const { level, ...rest } = info;
  return Object.assign(info, redactor.redact(rest), { level });
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    redactSecrets(),
    winston.format.timestamp(),
    env.NODE_ENV === "development" ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level}] ${stack ?? message}${metaStr}`;
    }),
  ),
  transports: [new winston.transports.Console(), new MongoLogTransport()],
});

/**
 * Applies the admin-configurable Settings.systemLogLevel to the running
 * logger without requiring a server restart -- both the console transport
 * and MongoLogTransport immediately honor the new threshold, since winston
 * filters by `logger.level` before invoking any transport. Called once at
 * boot (see server.ts) with the persisted setting, and again whenever an
 * admin updates it from the Settings page (see settingsService.setSystemLogLevel).
 */
export function applyLogLevel(level: string): void {
  logger.level = level;
}
