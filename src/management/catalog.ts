import catalogJson from "../../contracts/management-v0.1/operations.json" with { type: "json" };
import type { JsonObject, JsonValue } from "../contracts/types.js";

export interface ValueSchema { type?: string | string[]; properties?: Record<string, ValueSchema>; required?: string[]; items?: ValueSchema; additionalProperties?: boolean; }
export interface OperationDefinition {
  mode: "read" | "write"; required_scope: string; requires_confirmation: boolean;
  requires_expected_version: boolean; requires_idempotency: boolean;
  arguments_schema: ValueSchema; success_data_schema: ValueSchema; error_codes: string[];
}
export const MANAGEMENT_PROTOCOL_VERSION = "0.1.0-alpha.3" as const;
export const MANAGEMENT_OPERATIONS = (catalogJson as { protocol_version: string; operations: Record<string, OperationDefinition> }).operations;
export const WRITE_OPERATIONS = Object.entries(MANAGEMENT_OPERATIONS).filter(([, value]) => value.mode === "write");
export type ManagementArguments = JsonObject;
export function operationsFor(surface: "plugins" | "capabilities" | "runtime" | "audit") {
  const prefixes: Record<typeof surface, string[]> = {
    plugins: ["system.plugins.", "system.config.", "system.secrets.", "system.identity."],
    capabilities: ["system.grants.", "system.capabilities.call"],
    runtime: ["system.invocations.", "system.reconciliation.", "system.resources."],
    audit: ["system.audit.retention."]
  };
  return WRITE_OPERATIONS.filter(([name]) => prefixes[surface].some((prefix) => name.startsWith(prefix)));
}
export function validateArguments(definition: OperationDefinition, value: ManagementArguments): void {
  const allowed = definition.arguments_schema.properties ?? {};
  for (const key of definition.arguments_schema.required ?? []) if (!(key in value)) throw new Error(`Missing required argument: ${key}`);
  for (const key of Object.keys(value)) if (!(key in allowed)) throw new Error(`Unknown argument: ${key}`);
  rejectSecretValues(value);
}
function rejectSecretValues(value: JsonValue, key = ""): void {
  if (typeof value === "string") {
    if (/secret|token|password|api[_-]?key/i.test(key) && !value.startsWith("secretref://")) throw new Error("Secret-like arguments must use secretref:// references");
    return;
  }
  if (Array.isArray(value)) { value.forEach((item) => rejectSecretValues(item, key)); return; }
  if (value && typeof value === "object") for (const [childKey, item] of Object.entries(value)) rejectSecretValues(item, childKey);
}
