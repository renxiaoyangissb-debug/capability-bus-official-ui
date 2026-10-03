import { CoreOfflineError } from "../client/transport.js";
import type { JsonObject } from "../contracts/types.js";
import { MANAGEMENT_OPERATIONS, MANAGEMENT_PROTOCOL_VERSION, validateArguments } from "./catalog.js";

export interface ManagementRequest {
  protocol_version: typeof MANAGEMENT_PROTOCOL_VERSION; request_id: string; trace_id: string;
  timestamp: string; nonce: string;
  operation: string; arguments: JsonObject; idempotency_key: string | null; expected_version: number | null;
  confirmation: { confirmed: true; operation: string } | null;
}
export interface ManagementResponse {
  protocol_version: typeof MANAGEMENT_PROTOCOL_VERSION; request_id: string; trace_id: string; ok: boolean;
  authorization: { decision: "allow" | "deny" | "error"; reason_code: string }; audit_id: number | null;
  data: unknown; error: { code: string; message: string; retryable: boolean } | null;
}
export interface ManagementTransport { invoke(request: ManagementRequest): Promise<unknown>; }
export type ManagementResult =
  | { state: "ready"; data: unknown; requestId: string; traceId: string; auditId: number | null }
  | { state: "offline" | "incompatible"; message: string; requestId: string; traceId: string; auditId: null }
  | { state: "forbidden" | "version_conflict" | "idempotency_conflict" | "error"; error: NonNullable<ManagementResponse["error"]>; requestId: string; traceId: string; auditId: number | null };
export interface ManagementOptions { idempotencyKey?: string; expectedVersion?: number; confirmed?: boolean; }

export class ManagementClient {
  constructor(private readonly transport: ManagementTransport) {}
  async call(operation: string, args: JsonObject, options: ManagementOptions = {}): Promise<ManagementResult> {
    const definition = MANAGEMENT_OPERATIONS[operation];
    const requestId = `mreq_${randomHex()}`; const traceId = `trace_${randomHex()}`;
    if (!definition) return localError("VALIDATION_FAILED", "Operation is not in the frozen catalog", requestId, traceId);
    try { validateArguments(definition, args); }
    catch (error) { return localError("VALIDATION_FAILED", error instanceof Error ? error.message : "Arguments are invalid", requestId, traceId); }
    try {
      if (definition.requires_idempotency && !options.idempotencyKey) return localError("IDEMPOTENCY_KEY_REQUIRED", "An idempotency key is required", requestId, traceId);
      if (definition.requires_expected_version && options.expectedVersion === undefined) return localError("EXPECTED_VERSION_REQUIRED", "An expected version is required", requestId, traceId);
      if (definition.requires_confirmation && options.confirmed !== true) return localError("CONFIRMATION_REQUIRED", "Explicit confirmation is required", requestId, traceId);
      const request: ManagementRequest = {
        protocol_version: MANAGEMENT_PROTOCOL_VERSION, request_id: requestId, trace_id: traceId,
        timestamp: new Date().toISOString(), nonce: `nonce_${randomHex()}`, operation, arguments: args,
        idempotency_key: definition.requires_idempotency ? options.idempotencyKey! : null,
        expected_version: definition.requires_expected_version ? options.expectedVersion! : null,
        confirmation: definition.requires_confirmation ? { confirmed: true, operation } : null
      };
      const response = parseResponse(await this.transport.invoke(request));
      if (response.request_id !== requestId || response.trace_id !== traceId) throw new Error("Management response correlation mismatch");
      if (response.ok) return { state: "ready", data: response.data, requestId, traceId, auditId: response.audit_id };
      const error = response.error!;
      const state = error.code === "MANAGEMENT_SCOPE_DENIED" ? "forbidden" : error.code === "CONFIG_VERSION_CONFLICT" ? "version_conflict" : error.code.startsWith("IDEMPOTENCY_") ? "idempotency_conflict" : "error";
      return { state, error, requestId, traceId, auditId: response.audit_id };
    } catch (error) {
      if (error instanceof CoreOfflineError) return { state: "offline", message: error.message, requestId, traceId, auditId: null };
      return { state: "incompatible", message: error instanceof Error ? error.message : "Management transport failed", requestId, traceId, auditId: null };
    }
  }
}
function parseResponse(value: unknown): ManagementResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Management response must be an object");
  const response = value as Record<string, unknown>;
  if (response.protocol_version !== MANAGEMENT_PROTOCOL_VERSION) throw new Error("Unsupported management protocol version");
  if (typeof response.ok !== "boolean" || typeof response.request_id !== "string" || typeof response.trace_id !== "string") throw new Error("Management response is malformed");
  if (!response.authorization || typeof response.authorization !== "object") throw new Error("Management authorization result is missing");
  if (!response.ok && (!response.error || typeof response.error !== "object")) throw new Error("Failed management response requires an error");
  return value as ManagementResponse;
}
function localError(code: string, message: string, requestId: string, traceId: string): ManagementResult {
  return { state: code === "CONFIG_VERSION_CONFLICT" ? "version_conflict" : code.startsWith("IDEMPOTENCY_") ? "idempotency_conflict" : "error", error: { code, message, retryable: false }, requestId, traceId, auditId: null };
}
function randomHex() { return crypto.randomUUID().replaceAll("-", ""); }
