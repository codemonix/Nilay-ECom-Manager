import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { logger, applyLogLevel } from "./config/logger";
import * as settingsService from "./services/settingsService";
import { startSystemLogRetentionJob } from "./jobs/systemLogRetentionJob";

async function main() {
  await connectDatabase();

  const settings = await settingsService.getSettings();
  applyLogLevel(settings.systemLogLevel);
  startSystemLogRetentionJob();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`API server listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (env.SHOPFA_MOCK) {
      logger.info("Shopfa integration running in MOCK mode (SHOPFA_MOCK=true)");
    }
  });
}

main().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
