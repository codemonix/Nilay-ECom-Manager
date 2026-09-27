import { defineConfig } from "vitest/config";

/**
 * Live Shopfa tests (tests-live/): they create, change and cancel REAL orders
 * on the store, so they never run with `npm test`. Run explicitly with
 * `npm run test:live` (requires SHOPFA_LIVE_TEST=1 and apps/api/.env).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests-live/**/*.live.ts"],
    setupFiles: ["./tests-live/setup.ts"],
    testTimeout: 180000,
    hookTimeout: 300000,
    pool: "forks",
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
