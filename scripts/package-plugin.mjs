import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { dependencyInventory } from "./dependency-inventory.mjs";

const output = "build/plugin/ui.official.web";
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync("plugin/ui.official.web", output, { recursive: true });
cpSync("dist", join(output, "web"), { recursive: true });
mkdirSync(join(output, "LICENSES"), { recursive: true });
const inventory = dependencyInventory();
writeFileSync(join(output, "LICENSES/dependencies.json"), `${JSON.stringify(inventory, null, 2)}\n`);
const missingLicenseTexts = [];
for (const dependency of inventory) {
  const directory = join("node_modules", dependency.name);
  const licenseFile = readdirSync(directory).find((name) => /^(?:licen[cs]e|copying)(?:\..*)?$/i.test(name));
  if (!licenseFile || !existsSync(join(directory, licenseFile))) {
    missingLicenseTexts.push({ name: dependency.name, version: dependency.version, declared_license: dependency.license });
    continue;
  }
  const safeName = `${dependency.name.replace("/", "__")}-${dependency.version}-${licenseFile}`;
  cpSync(join(directory, licenseFile), join(output, "LICENSES", safeName));
}
writeFileSync(join(output, "LICENSES/license-text-missing.json"), `${JSON.stringify(missingLicenseTexts, null, 2)}\n`);
const checksums = {};
for (const file of walk(output).sort()) {
  const name = relative(output, file);
  if (name === "checksums.json") continue;
  checksums[name] = createHash("sha256").update(readFileSync(file)).digest("hex");
}
writeFileSync(join(output, "checksums.json"), `${JSON.stringify({ algorithm: "sha256", files: checksums }, null, 2)}\n`);
console.log(`plugin package: ${Object.keys(checksums).length} integrity entries`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}
