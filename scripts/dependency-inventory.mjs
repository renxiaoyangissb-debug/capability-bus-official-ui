import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function dependencyInventory(root = "node_modules") {
  if (!existsSync(root)) throw new Error("node_modules is missing; install the locked dependencies first");
  const entries = [];
  for (const name of readdirSync(root).sort()) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      for (const child of readdirSync(join(root, name)).sort()) add(join(root, name, child));
    } else add(join(root, name));
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));

  function add(directory) {
    const file = join(directory, "package.json");
    if (!existsSync(file)) return;
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    entries.push({ name: pkg.name, version: pkg.version, license: normalize(pkg.license), repository: repository(pkg.repository) });
  }
}

function normalize(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value.type === "string") return value.type;
  return "UNKNOWN";
}
function repository(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.url === "string") return value.url;
  return null;
}
