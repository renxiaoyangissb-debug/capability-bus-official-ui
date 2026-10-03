import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

test("backend keeps Core credentials server-side and enforces pairing, Origin, and CSRF", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "capbus-ui-bridge-"));
  const socketPath = join(temporary, "core.sock");
  const key = randomBytes(32);
  let captured;
  const core = createServer((connection) => {
    let pending = "";
    connection.on("data", (chunk) => {
      pending += chunk.toString("utf8");
      if (!pending.includes("\n")) return;
      const envelope = JSON.parse(pending.split("\n", 1)[0]);
      captured = envelope;
      const request = envelope.request;
      connection.end(`${JSON.stringify({ protocol_version: "0.1.0-alpha.3", request_id: request.request_id, trace_id: request.trace_id, ok: true, authorization: { decision: "allow", reason_code: "ALLOW" }, audit_id: 17, data: { status: "ok" }, error: null })}\n`);
    });
  });
  await new Promise((resolve, reject) => core.listen(socketPath, resolve).once("error", reject));
  const child = spawn("python3", ["plugin/ui.official.web/server/plugin.py"], {
    env: {
      CAPBUS_PROTOCOL_VERSION: "0.1.0-alpha.1", CAPBUS_PLUGIN_ID: "ui.official.web",
      CAPBUS_MANAGEMENT_SOCKET: socketPath, CAPBUS_MANAGEMENT_PROTOCOL_VERSION: "0.1.0-alpha.3",
      CAPBUS_MANAGEMENT_IDENTITY_ID: "plugin:plugin_1234", CAPBUS_MANAGEMENT_CREDENTIAL_ID: "cred_runtime",
      CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION: "4", CAPBUS_MANAGEMENT_HMAC_KEY: key.toString("hex")
    }, stdio: ["pipe", "pipe", "pipe"]
  });
  context.after(async () => { child.kill(); core.close(); await rm(temporary, { recursive: true, force: true }); });
  const lines = createInterface({ input: child.stdout }); const iterator = lines[Symbol.asyncIterator]();
  const hello = JSON.parse((await iterator.next()).value);
  assert.deepEqual(hello.capabilities, ["ui.session.status"]);
  child.stdin.write(`${JSON.stringify({ type: "request", request: { request_id: "req_status", capability: "ui.session.status" } })}\n`);
  const status = JSON.parse((await iterator.next()).value).data;
  assert.equal(status.http_listening, true); assert.equal(status.production_web_security, true);
  assert.match(status.url, /^http:\/\/127\.0\.0\.1:\d+$/); assert.ok(!JSON.stringify(status).includes(key.toString("hex")));

  const pair = await fetch(status.pairing_url, { redirect: "manual" });
  assert.equal(pair.status, 303);
  const cookie = pair.headers.get("set-cookie").split(";", 1)[0];
  assert.match(cookie, /^capbus_ui_session=/);
  assert.equal((await fetch(status.pairing_url, { redirect: "manual" })).status, 403);
  assert.equal((await fetch(`${status.url}/api/session`, { method: "POST", headers: { Origin: "http://evil.invalid", Cookie: cookie } })).status, 403);
  const session = await fetch(`${status.url}/api/session`, { method: "POST", headers: { Origin: status.url, Cookie: cookie } });
  const csrf = (await session.json()).csrf_token;
  const draft = { protocol_version: "0.1.0-alpha.3", request_id: "mreq_test", trace_id: "trace_test", timestamp: "2026-10-03T00:00:00Z", nonce: "nonce_test", operation: "system.status.get", arguments: {}, idempotency_key: null, expected_version: null, confirmation: null };
  assert.equal((await fetch(`${status.url}/api/management`, { method: "POST", headers: { Origin: status.url, Cookie: cookie, "content-type": "application/json", "x-csrf-token": "wrong" }, body: JSON.stringify(draft) })).status, 403);
  const response = await fetch(`${status.url}/api/management`, { method: "POST", headers: { Origin: status.url, Cookie: cookie, "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(draft) });
  const result = await response.json();
  assert.equal(result.ok, true); assert.equal(result.audit_id, 17);
  assert.equal(captured.protocol, "capbus-local-control-v1"); assert.equal(captured.operation, "management");
  assert.equal(captured.request.identity_id, "plugin:plugin_1234"); assert.equal(captured.request.credential_generation, 4);
  const unsigned = { ...captured.request }; delete unsigned.signature;
  const expected = createHmac("sha256", key).update(canonical(unsigned)).digest("hex");
  assert.equal(captured.request.signature, expected);
  assert.ok(!JSON.stringify(result).includes(key.toString("hex")));
  child.stdin.end();
  assert.equal(await new Promise((resolve) => child.once("exit", resolve)), 0);
});

test("backend rejects an incompatible management bootstrap before binding", async () => {
  const child = spawn("python3", ["plugin/ui.official.web/server/plugin.py"], { env: {
    CAPBUS_PROTOCOL_VERSION: "0.1.0-alpha.1", CAPBUS_PLUGIN_ID: "ui.official.web", CAPBUS_MANAGEMENT_SOCKET: "/not-used",
    CAPBUS_MANAGEMENT_PROTOCOL_VERSION: "0.1.0-alpha.999", CAPBUS_MANAGEMENT_IDENTITY_ID: "plugin:plugin_1234",
    CAPBUS_MANAGEMENT_CREDENTIAL_ID: "cred_runtime", CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION: "1", CAPBUS_MANAGEMENT_HMAC_KEY: randomBytes(32).toString("hex")
  }, stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(await new Promise((resolve) => child.once("exit", resolve)), 1);
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
