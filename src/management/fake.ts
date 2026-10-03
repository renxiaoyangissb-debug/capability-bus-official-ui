import { CoreOfflineError } from "../client/transport.js";
import { MANAGEMENT_OPERATIONS, MANAGEMENT_PROTOCOL_VERSION } from "./catalog.js";
import type { ManagementRequest, ManagementResponse, ManagementTransport } from "./client.js";
export type ManagementScenario = "ready" | "offline" | "incompatible" | "forbidden" | "error" | "version_conflict" | "idempotency_conflict";
export class FakeManagementTransport implements ManagementTransport {
  constructor(private readonly scenario: ManagementScenario = "ready") {}
  async invoke(request: ManagementRequest): Promise<unknown> {
    if (this.scenario === "offline") throw new CoreOfflineError("Frozen management fake is offline");
    if (this.scenario === "incompatible") return { ...success(request), protocol_version: "9.0.0" };
    const definition = MANAGEMENT_OPERATIONS[request.operation];
    if (!definition) return failure(request, "VALIDATION_FAILED", "Operation is not in the frozen catalog");
    if (definition.requires_idempotency && !request.idempotency_key) return failure(request, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required");
    if (definition.requires_expected_version && request.expected_version === null) return failure(request, "EXPECTED_VERSION_REQUIRED", "Expected version required");
    if (definition.requires_confirmation && request.confirmation?.operation !== request.operation) return failure(request, "CONFIRMATION_REQUIRED", "Explicit confirmation required");
    if (this.scenario === "forbidden") return failure(request, "MANAGEMENT_SCOPE_DENIED", "Identity is not authorized for this operation");
    if (this.scenario === "version_conflict") return failure(request, "CONFIG_VERSION_CONFLICT", "Configuration changed since the supplied version", "error");
    if (this.scenario === "idempotency_conflict") return failure(request, "IDEMPOTENCY_FINGERPRINT_CONFLICT", "The idempotency key was used with different arguments");
    if (this.scenario === "error") return failure(request, "OPERATION_FAILED", "The frozen fake rejected the operation", "error");
    return success(request);
  }
}
function success(request: ManagementRequest): ManagementResponse {
  return { protocol_version: MANAGEMENT_PROTOCOL_VERSION, request_id: request.request_id, trace_id: request.trace_id, ok: true,
    authorization: { decision: "allow", reason_code: "ALLOW" }, audit_id: 101,
    data: { operation: request.operation, status: "accepted", request_id: request.request_id, trace_id: request.trace_id }, error: null };
}
function failure(request: ManagementRequest, code: string, message: string, decision: "deny" | "error" = "deny"): ManagementResponse {
  return { protocol_version: MANAGEMENT_PROTOCOL_VERSION, request_id: request.request_id, trace_id: request.trace_id, ok: false,
    authorization: { decision, reason_code: code }, audit_id: 102, data: null, error: { code, message, retryable: false } };
}
