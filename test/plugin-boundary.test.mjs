import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

test("manifest is a process-only interface plugin over the frozen management catalog", () => {
  const manifest = JSON.parse(readFileSync("plugin/ui.official.web/plugin.yaml", "utf8"));
  const catalog = JSON.parse(readFileSync("contracts/management-v0.1/operations.json", "utf8"));
  assert.equal(manifest.id, "ui.official.web");
  assert.equal(manifest.kind, "interface");
  assert.equal(manifest.runtime.type, "process");
  assert.match(manifest.runtime.command, /\.py$/);
  assert.deepEqual([...manifest.consumes].sort(), Object.keys(catalog.operations).sort());
  assert.equal(Object.values(catalog.operations).filter((operation) => operation.mode === "write").length, 21);
  assert.equal(manifest.permissions.network[0], "loopback-bind:127.0.0.1");
});

test("config schema rejects non-loopback hosts by construction", () => {
  const schema = JSON.parse(readFileSync("plugin/ui.official.web/schemas/config.json", "utf8"));
  assert.deepEqual(schema.properties.bind_host, { const: "127.0.0.1" });
  assert.deepEqual(schema.properties.port, { const: 0 });
  assert.deepEqual(schema.properties.session_ttl_minutes, { const: 30 });
  assert.equal(schema.additionalProperties, false);
});

test("independent plugin fails closed without the Core management bootstrap", async (context) => {
  const child = spawn("python3", ["plugin/ui.official.web/server/plugin.py"], {
    env: { ...process.env, CAPBUS_PROTOCOL_VERSION: "0.1.0-alpha.1", CAPBUS_PLUGIN_ID: "ui.official.web" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  context.after(() => child.kill());
  const code = await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(code, 1);
});
