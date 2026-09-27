import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";

// Real Shopfa credentials from apps/api/.env; local data (users, packing records, audit log) in a throwaway in-memory MongoDB.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
if (process.env.SHOPFA_LIVE_TEST !== "1") {
  throw new Error("Live Shopfa tests change real orders -- set SHOPFA_LIVE_TEST=1 to run them.");
}
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.SHOPFA_MOCK = "false";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";

const mongoose = (await import("mongoose")).default;
const { afterAll, beforeAll } = await import("vitest");
const { logger } = await import("../src/config/logger");
// Error logs carry request params (e.g. the test customer's mobile in a search) -- keep them out of test output.
for (const transport of logger.transports) transport.silent = true;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { settingsRepository } = await import("../src/repositories/settingsRepository");
  const { DataSource } = await import("@complaint-system/shared");
  await settingsRepository.setDataSource(DataSource.LIVE_API);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
