import { MongoMemoryServer } from "mongodb-memory-server";

// Must run before any application module (which eagerly validates
// process.env via src/config/env.ts) is imported by a test file. Vitest
// fully evaluates setupFiles -- including this top-level await -- before
// loading the associated test file, so this ordering is safe.
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.SHOPFA_MOCK = "true";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";

const mongoose = (await import("mongoose")).default;
const { afterAll, afterEach, beforeAll } = await import("vitest");

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
