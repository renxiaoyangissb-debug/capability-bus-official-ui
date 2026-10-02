import type { EnvelopeClient } from "../client/envelope-client.js";
import type { ClientResult } from "../client/result.js";
import type { ErrorEnvelope, JsonObject, JsonValue } from "../contracts/types.js";

export const FROZEN_READ_CAPABILITIES = [
  "system.status.get",
  "system.plugins.list",
  "system.plugins.inspect",
  "system.capabilities.list",
  "system.capabilities.describe",
  "system.grants.list",
  "system.audit.list"
] as const;

export type PageId = "dashboard" | "plugins" | "capabilities" | "runtime" | "audit";

export type SurfaceFailure =
  | { state: "offline"; message: string; traceId: string }
  | { state: "incompatible"; message: string; traceId: string }
  | { state: "forbidden"; error: ErrorEnvelope; traceId: string }
  | { state: "error"; error: ErrorEnvelope; traceId: string };

export type SurfaceState =
  | { state: "loading" }
  | SurfaceFailure
  | { state: "ready"; snapshot: ManagementSnapshot };

export interface ManagementSnapshot {
  status: JsonObject;
  plugins: JsonObject[];
  pluginDetail: JsonObject | null;
  capabilities: JsonObject[];
  capabilityDetail: JsonObject | null;
  grants: JsonObject[];
  auditItems: JsonObject[];
  nextAuditCursor: number | null;
  traces: Record<string, string>;
}

export interface PageCopy {
  eyebrow: string;
  title: string;
  description: string;
}

export const PAGE_COPY: Record<PageId, PageCopy> = {
  dashboard: {
    eyebrow: "System overview",
    title: "Dashboard",
    description: "A read-only pulse of the frozen Core surface and its registered providers."
  },
  plugins: {
    eyebrow: "Registry",
    title: "Plugins",
    description: "Stable identities, trust boundaries, versions, and lifecycle states reported by Core."
  },
  capabilities: {
    eyebrow: "Routing map",
    title: "Capabilities",
    description: "Public capability ownership and operation semantics, without invocation controls."
  },
  runtime: {
    eyebrow: "Runtime projection",
    title: "Runtime",
    description: "Lifecycle health derived only from frozen status and plugin read capabilities."
  },
  audit: {
    eyebrow: "Metadata trail",
    title: "Audit",
    description: "Structured decisions and stable references only; payload content is never displayed."
  }
};

export async function loadManagementSnapshot(client: EnvelopeClient): Promise<SurfaceState> {
  const [status, plugins, capabilities, grants, audit] = await Promise.all([
    client.call("system.status.get"),
    client.call("system.plugins.list"),
    client.call("system.capabilities.list"),
    client.call("system.grants.list"),
    client.listAudit({ limit: 50 })
  ]);
  const firstFailure = [status, plugins, capabilities, grants, audit].find(
    (result): result is Exclude<ClientResult, { state: "ready" }> => result.state !== "ready"
  );
  if (firstFailure) return firstFailure;

  const readyStatus = ready(status);
  const readyPlugins = ready(plugins);
  const readyCapabilities = ready(capabilities);
  const readyGrants = ready(grants);
  const readyAudit = ready(audit);
  const pluginItems = objectItems(readyPlugins.data);
  const capabilityItems = objectItems(readyCapabilities.data);

  const [pluginDetail, capabilityDetail] = await Promise.all([
    pluginItems.length > 0 ? client.call("system.plugins.inspect") : Promise.resolve(null),
    capabilityItems.length > 0 ? client.call("system.capabilities.describe") : Promise.resolve(null)
  ]);
  const detailFailure = [pluginDetail, capabilityDetail].find(
    (result): result is Exclude<ClientResult, { state: "ready" }> => result !== null && result.state !== "ready"
  );
  if (detailFailure) return detailFailure;

  return {
    state: "ready",
    snapshot: {
      status: readyStatus.data,
      plugins: pluginItems,
      pluginDetail: pluginDetail === null ? null : ready(pluginDetail).data,
      capabilities: capabilityItems,
      capabilityDetail: capabilityDetail === null ? null : ready(capabilityDetail).data,
      grants: objectItems(readyGrants.data),
      auditItems: objectItems(readyAudit.data),
      nextAuditCursor: nullableInteger(readyAudit.data.next_cursor),
      traces: {
        status: readyStatus.traceId,
        plugins: readyPlugins.traceId,
        capabilities: readyCapabilities.traceId,
        grants: readyGrants.traceId,
        audit: readyAudit.traceId
      }
    }
  };
}

export function stringField(value: JsonObject, key: string, fallback = "—"): string {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : fallback;
}

export function booleanField(value: JsonObject, key: string): boolean | null {
  const field = value[key];
  return typeof field === "boolean" ? field : null;
}

export function numberField(value: JsonObject, key: string): number | null {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

export function nestedStrings(value: JsonObject, key: string, nestedKey: string): string[] {
  const parent = value[key];
  if (!isObject(parent)) return [];
  const candidate = parent[nestedKey];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
}

export function arrayStrings(value: JsonObject, key: string): string[] {
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
}

export function compactId(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 11)}…${value.slice(-8)}`;
}

export function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(timestamp) + " UTC";
}

function ready(result: ClientResult): Extract<ClientResult, { state: "ready" }> {
  if (result.state !== "ready") throw new Error("Expected a ready client result");
  return result;
}

function objectItems(value: JsonObject): JsonObject[] {
  const items = value.items;
  if (!Array.isArray(items)) return [];
  return items.filter(isObject);
}

function nullableInteger(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
