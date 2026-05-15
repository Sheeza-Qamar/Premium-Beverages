/**
 * Ensures `.next` is a complete production output before `next start`.
 * Avoids ENOENT on prerender-manifest.json when a prior build exited early
 * (e.g. Turbopack prerender flake on Windows) or `.next` was removed.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, ".next", "prerender-manifest.json");
const buildIdPath = join(root, ".next", "BUILD_ID");

const require = createRequire(join(root, "package.json"));
let nextCli;
try {
  nextCli = require.resolve("next/dist/bin/next");
} catch {
  console.error("[start] Could not resolve Next.js CLI. Run npm install from the project root.");
  process.exit(1);
}

function runNext(args) {
  const r = spawnSync(process.execPath, [nextCli, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(manifest) || !existsSync(buildIdPath)) {
  console.info(
    "[start] Production output missing or incomplete (.next/prerender-manifest.json). Running a full webpack build…",
  );
  runNext(["build", "--webpack"]);
}

if (!existsSync(manifest)) {
  console.error("[start] Build finished but prerender-manifest.json is still missing. Try: npm run build");
  process.exit(1);
}

runNext(["start"]);
