import winston from "winston";
import { env } from "./env";
import { MongoLogTransport } from "./mongoLogTransport";

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
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
