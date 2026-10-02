import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = "build/plugin/ui.official.web";
const manifest = JSON.parse(readFileSync(join(root, "plugin.yaml"), "utf8"));
if (manifest.id !== "ui.official.web" || manifest.runtime.command !== "server/plugin.py") throw new Error("Packaged manifest boundary changed");
if (!existsSync(join(root, "web/index.html"))) throw new Error("Static UI entry is missing");
const record = JSON.parse(readFileSync(join(root, "checksums.json"), "utf8"));
const actual = walk(root).map((file) => relative(root, file)).filter((file) => file !== "checksums.json").sort();
if (JSON.stringify(actual) !== JSON.stringify(Object.keys(record.files).sort())) throw new Error("Package checksum inventory mismatch");
for (const file of actual) {
  const digest = createHash("sha256").update(readFileSync(join(root, file))).digest("hex");
  if (record.files[file] !== digest) throw new Error(`Package checksum mismatch: ${file}`);
}
console.log(`plugin package: ${actual.length} files verified`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}
