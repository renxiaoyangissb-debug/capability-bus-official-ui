import test from "node:test";
import assert from "node:assert/strict";

import { EnvelopeClient } from "../build/test/src/client/envelope-client.js";
import { FakeCoreTransport } from "../build/test/src/client/fake-core.js";
import { FROZEN_READ_CAPABILITIES, loadManagementSnapshot } from "../build/test/src/ui/model.js";

const clientFor = (scenario) => new EnvelopeClient(new FakeCoreTransport(scenario), { subjectId: "ui.official.web:viewer" });

test("U2 ready model is assembled only from all seven frozen read capabilities", async () => {
  const calls = [];
  const fake = new FakeCoreTransport("ready");
  const client = new EnvelopeClient({
    async invoke(request) {
      calls.push(request.capability);
      return fake.invoke(request);
    }
  }, { subjectId: "ui.official.web:viewer" });

  const result = await loadManagementSnapshot(client);
  assert.equal(result.state, "ready");
  assert.deepEqual([...new Set(calls)].sort(), [...FROZEN_READ_CAPABILITIES].sort());
  assert.ok(calls.every((capability) => /\.(?:get|list|inspect|describe)$/.test(capability)));
  assert.equal(result.snapshot.plugins[0].plugin_id, "example.echo");
  assert.equal(result.snapshot.capabilities[0].capability, "example.echo");
  assert.equal(result.snapshot.grants[0].status, "active");
  assert.equal(result.snapshot.auditItems[0].decision, "allow");
});

test("empty results remain explicit and do not invent detail reads", async () => {
  const result = await loadManagementSnapshot(clientFor("empty"));
  assert.equal(result.state, "ready");
  assert.deepEqual(result.snapshot.plugins, []);
  assert.deepEqual(result.snapshot.capabilities, []);
  assert.deepEqual(result.snapshot.grants, []);
  assert.deepEqual(result.snapshot.auditItems, []);
  assert.equal(result.snapshot.pluginDetail, null);
  assert.equal(result.snapshot.capabilityDetail, null);
});

test("offline, incompatible, forbidden, and Core error states stay distinct", async () => {
  for (const scenario of ["offline", "incompatible", "forbidden", "error"]) {
    const result = await loadManagementSnapshot(clientFor(scenario));
    assert.equal(result.state, scenario);
    assert.match(result.traceId, /^trace_[0-9a-f]{32}$/);
  }
});

test("permission and Core error codes are preserved for UI display", async () => {
  const forbidden = await loadManagementSnapshot(clientFor("forbidden"));
  assert.equal(forbidden.state, "forbidden");
  assert.equal(forbidden.error.code, "GRANT_REQUIRED");

  const error = await loadManagementSnapshot(clientFor("error"));
  assert.equal(error.state, "error");
  assert.equal(error.error.code, "RESOURCE_DISK_PRESSURE");
  assert.equal(error.error.retryable, true);
});
