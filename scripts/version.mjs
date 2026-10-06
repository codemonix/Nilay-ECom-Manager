#!/usr/bin/env node
// Single source of truth for the app version shown in the UI and reported
// by the API. Nobody bumps a number by hand on each change:
//
//   MAJOR.MINOR  come from "version" in the root package.json (edit that
//                when you want to mark a bigger release).
//   PATCH        is the number of commits since that "version" line last
//                changed, so it goes up by itself on every commit and
//                restarts from 0 when MAJOR.MINOR is bumped.
//
// Usage:
//   node scripts/version.mjs           -> {"version":"1.0.14","commit":"75fc0ad","buildDate":"..."}
//   node scripts/version.mjs --github  -> version=1.0.14 ... lines for $GITHUB_OUTPUT
//   node scripts/version.mjs --export  -> export APP_VERSION=... line for eval in a shell
//
// Needs full git history (a shallow clone would undercount PATCH) -- the CI
// workflow checks out with fetch-depth: 0. Docker builds have no .git at
// all, so the images get these values as build args instead; see
// .github/workflows/docker-publish.yml.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(...args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function resolveVersion() {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const [major = "0", minor = "0"] = String(pkg.version).split(".");

  try {
    const commit = git("rev-parse", "--short", "HEAD");
    const buildDate = git("log", "-1", "--format=%cI");
    const versionCommit = git("log", "-1", "--format=%H", "-G", '^\\s*"version"\\s*:', "--", "package.json");
    const patch = versionCommit
      ? git("rev-list", "--count", `${versionCommit}..HEAD`)
      : git("rev-list", "--count", "HEAD");
    return { version: `${major}.${minor}.${patch}`, commit, buildDate };
  } catch {
    // Not a git checkout (e.g. a source tarball): still report something.
    return { version: `${major}.${minor}.0`, commit: "", buildDate: "" };
  }
}

const info = resolveVersion();

if (process.argv.includes("--github")) {
  console.log(`version=${info.version}\ncommit=${info.commit}\nbuild_date=${info.buildDate}`);
} else if (process.argv.includes("--export")) {
  console.log(`export APP_VERSION='${info.version}' APP_COMMIT='${info.commit}' APP_BUILD_DATE='${info.buildDate}'`);
} else {
  console.log(JSON.stringify(info));
}
