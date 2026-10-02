import { ContractViolation, parseResultEnvelope, validatePublicPayload } from "../contracts/guards.js";
import { PROTOCOL_VERSION, type JsonObject, type RequestEnvelope } from "../contracts/types.js";
import type { ClientResult } from "./result.js";
import { CoreOfflineError, type CoreTransport } from "./transport.js";

const forbiddenCodes = new Set([
  "GRANT_REQUIRED", "GRANT_INVALID", "GRANT_REVOKED", "GRANT_EXPIRED",
  "GRANT_SUBJECT_DENIED", "GRANT_CAPABILITY_DENIED", "GRANT_PROVIDER_DENIED"
]);

export interface ClientIdentity {
  subjectId: string;
  grantId?: string;
}

export class EnvelopeClient {
  constructor(private readonly transport: CoreTransport, private readonly identity: ClientIdentity) {}

  async call(capability: string, payload: JsonObject = {}): Promise<ClientResult> {
    const request = createRequest(capability, payload, this.identity);
    try {
      const result = parseResultEnvelope(await this.transport.invoke(request));
      if (result.request_id !== request.request_id || result.trace_id !== request.trace_id) {
        throw new ContractViolation("Result correlation does not match the request");
      }
      if (result.ok) return { state: "ready", data: result.data, traceId: result.trace_id, providerId: result.provider_id };
      const error = result.error!;
      return forbiddenCodes.has(error.code)
        ? { state: "forbidden", error, traceId: result.trace_id }
        : { state: "error", error, traceId: result.trace_id };
    } catch (error) {
      if (error instanceof CoreOfflineError) return { state: "offline", message: error.message, traceId: request.trace_id };
      if (error instanceof ContractViolation) return { state: "incompatible", message: error.message, traceId: request.trace_id };
      return { state: "offline", message: "Core transport failed", traceId: request.trace_id };
    }
  }

  listAudit(options: { cursor?: number; limit?: number } = {}): Promise<ClientResult> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError("Audit limit must be an integer from 1 to 200");
    if (options.cursor !== undefined && (!Number.isInteger(options.cursor) || options.cursor < 1)) throw new RangeError("Audit cursor must be a positive integer");
    return this.call("system.audit.list", { limit, cursor: options.cursor ?? null });
  }
}

function randomHex(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function createRequest(capability: string, payload: JsonObject, identity: ClientIdentity): RequestEnvelope {
  validatePublicPayload(payload);
  if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)+$/.test(capability)) throw new ContractViolation("Capability name is invalid");
  const request: RequestEnvelope = {
    request_id: `req_${randomHex()}`,
    trace_id: `trace_${randomHex()}`,
    capability,
    caller: { subject_id: identity.subjectId },
    grant: identity.grantId ? { grant_id: identity.grantId } : null,
    idempotency_key: null,
    payload,
    created_at: new Date().toISOString(),
    protocol_version: PROTOCOL_VERSION
  };
  return request;
}
