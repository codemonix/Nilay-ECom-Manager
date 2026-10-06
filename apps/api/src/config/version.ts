import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { VersionInfoDTO } from "@complaint-system/shared";

/**
 * Docker images have no git history, so CI computes the version with
 * scripts/version.mjs and bakes it in as APP_VERSION / APP_COMMIT /
 * APP_BUILD_DATE (see apps/api/Dockerfile). A local checkout has none of
 * those set and asks the same script directly instead.
 */
function loadVersion(): VersionInfoDTO {
  if (process.env.APP_VERSION) {
    return {
      version: process.env.APP_VERSION,
      commit: process.env.APP_COMMIT ?? "",
      buildDate: process.env.APP_BUILD_DATE ?? "",
    };
  }

  // src/config and dist/src/config sit at different depths below the repo
  // root, so walk up until the script turns up.
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth++) {
    const script = path.join(dir, "scripts", "version.mjs");
    if (fs.existsSync(script)) {
      try {
        const output = execFileSync(process.execPath, [script], {
          encoding: "utf8",
        });
        return JSON.parse(output) as VersionInfoDTO;
      } catch {
        break;
      }
    }
    dir = path.dirname(dir);
  }

  return { version: "unknown", commit: "", buildDate: "" };
}

export const versionInfo = loadVersion();
