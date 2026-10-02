import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

import { cachedTarballs, planLockedPackages, selectCachedTarballs } from "./offline-lock-plan.mjs";

const npmExecutable = command("which", ["npm"]).trim();
const npmRoot = resolve(dirname(realpathSync(npmExecutable)), "../node_modules");
const requireFromNpm = createRequire(join(npmRoot, "bootstrap.cjs"));
const cacache = requireFromNpm(join(npmRoot, "cacache"));
const configuredCache = process.env.CAPBUS_NPM_CACHE || command("npm", ["config", "get", "cache"]).trim();
const sourceCache = join(configuredCache, "_cacache");
const workspace = process.cwd();
const lockPath = join(workspace, "package-lock.json");
const lockSource = readFileSync(lockPath, "utf8");
const lock = JSON.parse(lockSource);
const temporary = mkdtempSync(join(tmpdir(), "capbus-ui-offline-npm-"));
const targetCache = join(temporary, "cache");
const targetContentCache = join(targetCache, "_cacache");

try {
  const available = cachedTarballs(await cacache.ls(sourceCache));
  const plan = planLockedPackages(lock);
  const selected = selectCachedTarballs(plan, available);

  for (const item of selected) {
    const data = (await cacache.get(sourceCache, item.source.key)).data;
    await cacache.put(targetContentCache, item.source.key, data, {
      metadata: item.source.entry.metadata,
      integrity: item.source.entry.integrity
    });
  }

  const install = spawnSync("npm", [
    "ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", targetCache
  ], { cwd: workspace, encoding: "utf8" });
  process.stdout.write(install.stdout);
  process.stderr.write(install.stderr);
  if (install.status !== 0) throw new Error(`Locked offline npm ci failed with status ${install.status ?? "unknown"}`);
  if (readFileSync(lockPath, "utf8") !== lockSource) throw new Error("Offline bootstrap changed package-lock.json");
  console.log(`offline bootstrap: ${selected.length} locked cached packages installed for ${process.platform}/${process.arch}`);
} finally {
  if (process.env.CAPBUS_KEEP_TEMP === "1") console.log(`offline cache retained at ${temporary}`);
  else rmSync(temporary, { recursive: true, force: true });
}

function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${basename(executable)} failed`);
  return result.stdout;
}
