import { parseRequestEnvelope } from "../contracts/guards.js";
import { PROTOCOL_VERSION, type ErrorEnvelope, type JsonObject, type RequestEnvelope, type ResultEnvelope } from "../contracts/types.js";
import { CoreOfflineError, type CoreTransport } from "./transport.js";

const providerId = "plugin_ffffffffffffffffffffffffffffffff";
export type FakeCoreScenario = "ready" | "empty" | "error" | "offline" | "incompatible" | "forbidden";

export class FakeCoreTransport implements CoreTransport {
  private readonly plugin: JsonObject = {
    system_id: "plugin_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    plugin_id: "example.echo",
    active_version: "0.1.0-alpha.1",
    trust_zone: "untrusted",
    lifecycle_state: "healthy"
  };
  private readonly capability: JsonObject = {
    capability: "example.echo",
    operation: "command",
    owner_system_id: this.plugin.system_id!,
    plugin_id: this.plugin.plugin_id!
  };
  private readonly grant: JsonObject = {
    grant_id: "grant_dddddddddddddddddddddddddddddddd",
    subject_id: "owner:local",
    plugin_system_id: this.plugin.system_id!,
    capability: "example.echo",
    scope: { capabilities: ["example.echo"] },
    status: "active",
    expires_at: null,
    created_at: "2026-10-01T00:00:00Z"
  };
  private readonly auditRecord: JsonObject = {
    audit_id: 1,
    request_id: "req_11111111111111111111111111111111",
    trace_id: "trace_22222222222222222222222222222222",
    subject_id: "owner:local",
    capability: "example.echo",
    decision: "allow",
    reason_code: "ALLOW",
    provider_system_id: "plugin_44444444444444444444444444444444",
    payload_keys: ["message"],
    created_at: "2026-10-01T00:00:01Z"
  };

  constructor(private readonly scenario: FakeCoreScenario = "ready") {}

  async invoke(value: RequestEnvelope): Promise<ResultEnvelope | unknown> {
    if (this.scenario === "offline") throw new CoreOfflineError("Frozen fake Core is offline");
    const request = parseRequestEnvelope(value);
    if (this.scenario === "incompatible") {
      return { ...success(request, {}), protocol_version: "9.0.0" };
    }
    if (this.scenario === "forbidden") {
      return failure(request, { code: "GRANT_REQUIRED", message: "The read capability requires a Grant", retryable: false, details: null });
    }
    if (this.scenario === "error") {
      return failure(request, { code: "RESOURCE_DISK_PRESSURE", message: "Core cannot complete the read while resource pressure is active", retryable: true, details: null });
    }
    const empty = this.scenario === "empty";
    switch (request.capability) {
      case "system.status.get": return success(request, { status: "ok", version: "0.1.0-alpha.1", fake: true });
      case "system.plugins.list": return success(request, { items: empty ? [] : [this.plugin] });
      case "system.plugins.inspect": return success(request, this.plugin);
      case "system.capabilities.list": return success(request, { items: empty ? [] : [this.capability] });
      case "system.capabilities.describe": return success(request, this.capability);
      case "system.grants.list": return success(request, { items: empty ? [] : [this.grant] });
      case "system.audit.list": return success(request, { items: empty ? [] : [this.auditRecord], next_cursor: null });
      default:
        return request.capability.startsWith("system.")
          ? failure(request, { code: "FAKE_MUTATION_NOT_APPLIED", message: "The frozen fake Core does not apply mutations", retryable: false, details: null })
          : failure(request, { code: "CAPABILITY_NOT_FOUND", message: "Capability is not present in the fake Core", retryable: false, details: null });
    }
  }
}

function base(request: RequestEnvelope): Omit<ResultEnvelope, "ok" | "data" | "error"> {
  return { request_id: request.request_id, trace_id: request.trace_id, provider_id: providerId, created_at: new Date().toISOString(), protocol_version: PROTOCOL_VERSION };
}
function success(request: RequestEnvelope, data: JsonObject): ResultEnvelope { return { ...base(request), ok: true, data, error: null }; }
function failure(request: RequestEnvelope, error: ErrorEnvelope): ResultEnvelope { return { ...base(request), ok: false, data: {}, error }; }
