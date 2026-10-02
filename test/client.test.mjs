import test from "node:test";
import assert from "node:assert/strict";

import { EnvelopeClient } from "../build/test/src/client/envelope-client.js";
import { FakeCoreTransport } from "../build/test/src/client/fake-core.js";
import { CoreOfflineError } from "../build/test/src/client/transport.js";

test("mock-driven read calls preserve trace and provider identity", async () => {
  const client = new EnvelopeClient(new FakeCoreTransport(), { subjectId: "owner:local" });
  const result = await client.call("system.plugins.list");
  assert.equal(result.state, "ready");
  assert.match(result.traceId, /^trace_[0-9a-f]{32}$/);
  assert.equal(result.data.items[0].plugin_id, "example.echo");
});

test("fake Core rejects un-frozen mutations as a structured error", async () => {
  const client = new EnvelopeClient(new FakeCoreTransport(), { subjectId: "owner:local" });
  const result = await client.call("system.plugins.start");
  assert.equal(result.state, "error");
  assert.equal(result.error.code, "FAKE_MUTATION_NOT_APPLIED");
  assert.match(result.traceId, /^trace_/);
});

test("permission errors remain permission errors with the Core trace", async () => {
  const transport = {
    async invoke(request) {
      return {
        request_id: request.request_id,
        trace_id: request.trace_id,
        provider_id: "plugin_ffffffffffffffffffffffffffffffff",
        ok: false,
        data: {},
        error: { code: "GRANT_REQUIRED", message: "Denied", retryable: false, details: null },
        created_at: new Date().toISOString(),
        protocol_version: "0.1.0-alpha.1"
      };
    }
  };
  const result = await new EnvelopeClient(transport, { subjectId: "owner:local" }).call("system.status.get");
  assert.equal(result.state, "forbidden");
  assert.equal(result.error.code, "GRANT_REQUIRED");
});

test("offline and incompatible transports have distinct states", async () => {
  const offline = new EnvelopeClient({ invoke: async () => { throw new CoreOfflineError(); } }, { subjectId: "owner:local" });
  assert.equal((await offline.call("system.status.get")).state, "offline");

  const incompatible = new EnvelopeClient({ invoke: async (request) => ({
    request_id: request.request_id, trace_id: request.trace_id, provider_id: "core", ok: true,
    data: {}, error: null, created_at: new Date().toISOString(), protocol_version: "9.0.0"
  }) }, { subjectId: "owner:local" });
  assert.equal((await incompatible.call("system.status.get")).state, "incompatible");
});

test("audit pagination validates bounds and forwards cursor", async () => {
  let payload;
  const transport = {
    async invoke(request) {
      payload = request.payload;
      return {
        request_id: request.request_id, trace_id: request.trace_id, provider_id: "core", ok: true,
        data: { items: [], next_cursor: null }, error: null, created_at: new Date().toISOString(),
        protocol_version: "0.1.0-alpha.1"
      };
    }
  };
  const client = new EnvelopeClient(transport, { subjectId: "owner:local" });
  assert.equal((await client.listAudit({ cursor: 7, limit: 25 })).state, "ready");
  assert.deepEqual(payload, { limit: 25, cursor: 7 });
  assert.throws(() => client.listAudit({ limit: 201 }), RangeError);
  assert.throws(() => client.listAudit({ cursor: 0 }), RangeError);
});
