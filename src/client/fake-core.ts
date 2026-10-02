import { parseRequestEnvelope } from "../contracts/guards.js";
import { PROTOCOL_VERSION, type ErrorEnvelope, type JsonObject, type RequestEnvelope, type ResultEnvelope } from "../contracts/types.js";
import type { CoreTransport } from "./transport.js";

const providerId = "plugin_ffffffffffffffffffffffffffffffff";

export class FakeCoreTransport implements CoreTransport {
  private readonly plugin: JsonObject = {
    system_id: "plugin_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    plugin_id: "example.echo",
    active_version: "0.1.0-alpha.1",
    trust_zone: "untrusted",
    lifecycle_state: "healthy"
  };

  async invoke(value: RequestEnvelope): Promise<ResultEnvelope> {
    const request = parseRequestEnvelope(value);
    switch (request.capability) {
      case "system.status.get": return success(request, { status: "ok", version: "0.1.0-alpha.1", fake: true });
      case "system.plugins.list": return success(request, { items: [this.plugin] });
      case "system.plugins.inspect": return success(request, this.plugin);
      case "system.capabilities.list": return success(request, { items: [{ capability: "example.echo", operation: "command", owner_system_id: this.plugin.system_id!, plugin_id: "example.echo" }] });
      case "system.capabilities.describe": return success(request, { capability: "example.echo", operation: "command", owner_system_id: this.plugin.system_id!, plugin_id: "example.echo" });
      case "system.grants.list": return success(request, { items: [] });
      case "system.audit.list": return success(request, { items: [], next_cursor: null });
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
