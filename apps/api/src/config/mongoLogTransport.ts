import Transport from "winston-transport";
import mongoose from "mongoose";
import { systemLogRepository } from "../repositories/systemLogRepository";

/**
 * Mirrors every winston log line (already filtered to the configured
 * Settings.systemLogLevel threshold by winston itself) into the SystemLog
 * collection so the admin Logs page can browse/search history, not just
 * tail the console. Silently drops lines written before Mongo is connected
 * (e.g. during bootstrap) and never lets a persistence failure crash the
 * app or recurse back into the logger.
 */
export class MongoLogTransport extends Transport {
  log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => this.emit("logged", info));

    if (mongoose.connection.readyState === 1) {
      // `timestamp` is left in `meta` (redundant with the document's own
      // createdAt, but harmless) rather than destructured out, since an
      // unused binding here would trip the no-unused-vars lint rule.
      const { level, message, stack, ...meta } = info;
      void systemLogRepository
        .create({
          level: String(level),
          message: stack ? String(stack) : String(message),
          context: typeof meta.context === "string" ? meta.context : null,
          meta: Object.keys(meta).length > 0 ? meta : null,
        })
        .catch(() => {
          // Never let logging itself crash the app or recurse into more error logs.
        });
    }

    callback();
  }
}
