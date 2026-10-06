import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Docker builds have no git history, so CI passes the version in as
 * APP_VERSION / APP_COMMIT / APP_BUILD_DATE (see apps/web/Dockerfile). A
 * local checkout has none of those set and asks scripts/version.mjs.
 */
function loadVersion(): { version: string; commit: string; buildDate: string } {
  if (process.env.APP_VERSION) {
    return {
      version: process.env.APP_VERSION,
      commit: process.env.APP_COMMIT ?? "",
      buildDate: process.env.APP_BUILD_DATE ?? "",
    };
  }
  try {
    const script = fileURLToPath(new URL("../../scripts/version.mjs", import.meta.url));
    return JSON.parse(execFileSync(process.execPath, [script], { encoding: "utf8" }));
  } catch {
    return { version: "unknown", commit: "", buildDate: "" };
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_INFO__: JSON.stringify(loadVersion()),
  },
  server: {
    port: 5173,
  },
});
