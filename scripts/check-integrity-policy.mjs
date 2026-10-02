import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sourceFiles = walk("src").filter((file) => /\.(?:ts|tsx)$/.test(file));
const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
for (const forbidden of ["localStorage", "sessionStorage", "sqlite3", "capability_bus_core", "capability_bus_sdk"]) {
  if (source.includes(forbidden)) throw new Error(`Forbidden UI boundary token found: ${forbidden}`);
}
const plugin = readFileSync("plugin/ui.official.web/server/plugin.py", "utf8");
for (const forbidden of ["import socket", "HTTPServer", "uvicorn", "flask", "capability_bus_core", "capability_bus_sdk"]) {
  if (plugin.includes(forbidden)) throw new Error(`Plugin shell may open a private boundary: ${forbidden}`);
}
const manifest = JSON.parse(readFileSync("plugin/ui.official.web/plugin.yaml", "utf8"));
const expected = ["system.status.get", "system.plugins.list", "system.plugins.inspect", "system.capabilities.list", "system.capabilities.describe", "system.grants.list", "system.audit.list"].sort();
if (JSON.stringify([...manifest.consumes].sort()) !== JSON.stringify(expected)) throw new Error("Manifest consumes capabilities outside frozen F1 read surface");
const config = JSON.parse(readFileSync("plugin/ui.official.web/schemas/config.json", "utf8"));
if (config.properties.bind_host.const !== "127.0.0.1") throw new Error("Config is not loopback locked");
console.log(`integrity policy: ${sourceFiles.length} source files and plugin boundaries checked`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}
