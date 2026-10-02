export const PROTOCOL_VERSION = "0.1.0-alpha.1" as const;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface CallerIdentityRef { subject_id: string; }
export interface GrantRef { grant_id: string; }
export interface SecretRef { uri: `secretref://${string}`; }

export interface RequestEnvelope {
  request_id: string;
  trace_id: string;
  capability: string;
  caller: CallerIdentityRef;
  grant?: GrantRef | null;
  idempotency_key?: string | null;
  payload: JsonObject;
  created_at: string;
  protocol_version: typeof PROTOCOL_VERSION;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonObject | null;
}

export interface ResultEnvelope {
  request_id: string;
  trace_id: string;
  provider_id: string;
  ok: boolean;
  data: JsonObject;
  error: ErrorEnvelope | null;
  created_at: string;
  protocol_version: typeof PROTOCOL_VERSION;
}

export interface AuditPage {
  items: JsonObject[];
  next_cursor: number | null;
}
