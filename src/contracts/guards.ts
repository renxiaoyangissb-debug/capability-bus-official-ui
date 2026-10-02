import {
  PROTOCOL_VERSION,
  type ErrorEnvelope,
  type JsonObject,
  type JsonValue,
  type RequestEnvelope,
  type ResultEnvelope
} from "./types.js";

const capabilityPattern = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)+$/;
const requestIdPattern = /^req_[0-9a-f]{32}$/;
const traceIdPattern = /^trace_[0-9a-f]{32}$/;
const errorCodePattern = /^[A-Z0-9_]{1,128}$/;
const sensitiveKeys = new Set(["secret", "token", "password", "api_key", "apikey"]);

export class ContractViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractViolation";
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractViolation(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !(key in value));
  if (unknown.length > 0) throw new ContractViolation(`${label} has unknown fields: ${unknown.sort().join(", ")}`);
  if (missing.length > 0) throw new ContractViolation(`${label} is missing fields: ${missing.join(", ")}`);
}

function string(value: unknown, label: string, max = Number.POSITIVE_INFINITY): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new ContractViolation(`${label} must be a non-empty string`);
  }
  return value;
}

function dateTime(value: unknown, label: string): string {
  const result = string(value, label);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new ContractViolation(`${label} must be an offset date-time`);
  }
  return result;
}

function isSecretRef(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("secretref://") && value.length > 12;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return isSecretRef((value as Record<string, unknown>).uri);
  }
  return false;
}

export function validatePublicPayload(value: unknown, depth = 0): asserts value is JsonValue {
  if (depth > 16) throw new ContractViolation("Public payload nesting is too deep");
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") {
    if (new TextEncoder().encode(value).byteLength > 1024 * 1024) throw new ContractViolation("Public payload string is too large");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => validatePublicPayload(item, depth + 1));
    return;
  }
  const record = object(value, "Public payload");
  for (const [key, item] of Object.entries(record)) {
    const normalized = key.toLowerCase().replaceAll("-", "_");
    if (sensitiveKeys.has(normalized) && !isSecretRef(item)) {
      throw new ContractViolation("Secret-like fields must contain a SecretRef");
    }
    validatePublicPayload(item, depth + 1);
  }
}

export function parseRequestEnvelope(value: unknown): RequestEnvelope {
  const record = object(value, "RequestEnvelope");
  exactKeys(record, ["request_id", "trace_id", "capability", "caller", "grant", "idempotency_key", "payload", "created_at", "protocol_version"], ["request_id", "trace_id", "capability", "caller", "payload", "created_at", "protocol_version"], "RequestEnvelope");
  const requestId = string(record.request_id, "RequestEnvelope.request_id");
  const traceId = string(record.trace_id, "RequestEnvelope.trace_id");
  if (!requestIdPattern.test(requestId) || !traceIdPattern.test(traceId)) throw new ContractViolation("Request or trace id is invalid");
  const capability = string(record.capability, "RequestEnvelope.capability");
  if (!capabilityPattern.test(capability)) throw new ContractViolation("Capability name is invalid");
  if (record.protocol_version !== PROTOCOL_VERSION) throw new ContractViolation("Unsupported request protocol version");
  const caller = object(record.caller, "RequestEnvelope.caller");
  exactKeys(caller, ["subject_id"], ["subject_id"], "RequestEnvelope.caller");
  const subjectId = string(caller.subject_id, "RequestEnvelope.caller.subject_id", 256);
  let grant: { grant_id: string } | null | undefined;
  if (record.grant !== undefined && record.grant !== null) {
    const grantValue = object(record.grant, "RequestEnvelope.grant");
    exactKeys(grantValue, ["grant_id"], ["grant_id"], "RequestEnvelope.grant");
    grant = { grant_id: string(grantValue.grant_id, "RequestEnvelope.grant.grant_id", 256) };
  } else grant = record.grant as null | undefined;
  if (record.idempotency_key !== undefined && record.idempotency_key !== null) string(record.idempotency_key, "RequestEnvelope.idempotency_key", 512);
  const payload = object(record.payload, "RequestEnvelope.payload");
  validatePublicPayload(payload);
  return {
    request_id: requestId,
    trace_id: traceId,
    capability,
    caller: { subject_id: subjectId },
    grant,
    idempotency_key: record.idempotency_key as string | null | undefined,
    payload: payload as JsonObject,
    created_at: dateTime(record.created_at, "RequestEnvelope.created_at"),
    protocol_version: PROTOCOL_VERSION
  };
}

function parseErrorEnvelope(value: unknown): ErrorEnvelope {
  const record = object(value, "ErrorEnvelope");
  exactKeys(record, ["code", "message", "retryable", "details"], ["code", "message", "retryable"], "ErrorEnvelope");
  const code = string(record.code, "ErrorEnvelope.code", 128);
  if (!errorCodePattern.test(code)) throw new ContractViolation("Error code is invalid");
  if (typeof record.message !== "string" || record.message.length > 512) throw new ContractViolation("Error message is invalid");
  if (typeof record.retryable !== "boolean") throw new ContractViolation("Error retryable must be a boolean");
  if (record.details !== undefined && record.details !== null) {
    object(record.details, "ErrorEnvelope.details");
    validatePublicPayload(record.details);
  }
  return { code, message: record.message, retryable: record.retryable, details: record.details as JsonObject | null | undefined };
}

export function parseResultEnvelope(value: unknown): ResultEnvelope {
  const record = object(value, "ResultEnvelope");
  exactKeys(record, ["request_id", "trace_id", "provider_id", "ok", "data", "error", "created_at", "protocol_version"], ["request_id", "trace_id", "provider_id", "ok", "data", "error", "created_at", "protocol_version"], "ResultEnvelope");
  if (record.protocol_version !== PROTOCOL_VERSION) throw new ContractViolation("Unsupported result protocol version");
  if (typeof record.ok !== "boolean") throw new ContractViolation("ResultEnvelope.ok must be a boolean");
  const data = object(record.data, "ResultEnvelope.data");
  validatePublicPayload(data);
  const error = record.error === null ? null : parseErrorEnvelope(record.error);
  if (record.ok && error !== null) throw new ContractViolation("Successful result cannot contain an error");
  if (!record.ok && error === null) throw new ContractViolation("Failed result requires an error");
  return {
    request_id: string(record.request_id, "ResultEnvelope.request_id"),
    trace_id: string(record.trace_id, "ResultEnvelope.trace_id"),
    provider_id: string(record.provider_id, "ResultEnvelope.provider_id"),
    ok: record.ok,
    data: data as JsonObject,
    error,
    created_at: dateTime(record.created_at, "ResultEnvelope.created_at"),
    protocol_version: PROTOCOL_VERSION
  };
}
