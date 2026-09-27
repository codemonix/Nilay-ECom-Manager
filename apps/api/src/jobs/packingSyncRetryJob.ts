import { logger } from "../config/logger";
import { runDueSyncs } from "../services/packingSyncService";

const CHECK_INTERVAL_MS = 60 * 1000;

let intervalHandle: NodeJS.Timeout | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runDueSyncs();
  } catch (err) {
    logger.error("Packing sync retry pass failed", { err });
  } finally {
    running = false;
  }
}

/**
 * Starts the background worker that re-pushes packed orders whose Shopfa
 * write failed (see packingSyncService). Call once at server boot (see
 * server.ts) -- never on module import, since tests construct the Express
 * app directly via createApp() without booting background jobs.
 */
export function startPackingSyncRetryJob(): void {
  if (intervalHandle) return;
  void tick();
  intervalHandle = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  intervalHandle.unref();
}
