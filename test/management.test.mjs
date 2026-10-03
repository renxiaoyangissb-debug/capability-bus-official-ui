import test from "node:test";
import assert from "node:assert/strict";
import { ManagementClient } from "../build/test/src/management/client.js";
import { FakeManagementTransport } from "../build/test/src/management/fake.js";
import { MANAGEMENT_OPERATIONS, operationsFor } from "../build/test/src/management/catalog.js";

test("catalog exposes exact operations and routes U3 surfaces", () => {
  assert.equal(Object.keys(MANAGEMENT_OPERATIONS).length, 42);
  for (const [surface, operation] of [["plugins","system.plugins.trust.set"],["plugins","system.config.rollback"],["plugins","system.secrets.register"],["plugins","system.identity.credential.rotate"],["capabilities","system.grants.create"],["runtime","system.reconciliation.resolve"],["audit","system.audit.retention.enforce"]]) assert.ok(operationsFor(surface).some(([name]) => name === operation));
});
test("high-impact operations require explicit confirmation and carry control evidence", async () => {
  let captured; const transport = { async invoke(request) { captured = request; return new FakeManagementTransport().invoke(request); } }; const client = new ManagementClient(transport);
  const denied = await client.call("system.plugins.trust.set", { plugin_id: "example.echo", trust_zone: "trusted" }, { idempotencyKey: "key" });
  assert.equal(denied.state, "error"); assert.equal(denied.error.code, "CONFIRMATION_REQUIRED"); assert.equal(captured, undefined);
  const accepted = await client.call("system.config.rollback", { plugin_id: "example.echo", target_version: 1 }, { idempotencyKey: "key", expectedVersion: 2, confirmed: true });
  assert.equal(accepted.state, "ready"); assert.equal(captured.idempotency_key, "key"); assert.equal(captured.expected_version, 2); assert.deepEqual(captured.confirmation, { confirmed: true, operation: "system.config.rollback" }); assert.equal(accepted.auditId, 101);
});
test("secret values are rejected while SecretRef is accepted", async () => {
  const client = new ManagementClient(new FakeManagementTransport());
  const rejected = await client.call("system.secrets.register", { secret_ref: "plaintext", plugin_id: null }, { idempotencyKey: "key" });
  assert.equal(rejected.state, "error"); assert.equal(rejected.error.code, "VALIDATION_FAILED");
  assert.equal((await client.call("system.secrets.register", { secret_ref: "secretref://example/item", plugin_id: null }, { idempotencyKey: "key" })).state, "ready");
});
test("management failures remain distinct with audit correlation", async () => {
  const operation = "system.grants.create"; const args = { subject_id: "owner:local", plugin_id: "example.echo", capability: "example.echo" };
  for (const [scenario, state, code] of [["forbidden","forbidden","MANAGEMENT_SCOPE_DENIED"],["version_conflict","version_conflict","CONFIG_VERSION_CONFLICT"],["idempotency_conflict","idempotency_conflict","IDEMPOTENCY_FINGERPRINT_CONFLICT"],["error","error","OPERATION_FAILED"]]) { const result = await new ManagementClient(new FakeManagementTransport(scenario)).call(operation, args, { idempotencyKey: "key" }); assert.equal(result.state, state); assert.equal(result.error.code, code); assert.equal(result.auditId, 102); }
  assert.equal((await new ManagementClient(new FakeManagementTransport("offline")).call(operation, args, { idempotencyKey: "key" })).state, "offline");
  assert.equal((await new ManagementClient(new FakeManagementTransport("incompatible")).call(operation, args, { idempotencyKey: "key" })).state, "incompatible");
});
