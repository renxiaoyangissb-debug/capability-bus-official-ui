import { useEffect, useState } from "react";
import type { JsonObject, JsonValue } from "../contracts/types.js";
import { MANAGEMENT_OPERATIONS, operationsFor, type OperationDefinition, type ValueSchema } from "../management/catalog.js";
import { ManagementClient, type ManagementResult } from "../management/client.js";

export function ManagementConsole({ surface, client, onChanged }: { surface: "plugins" | "capabilities" | "runtime" | "audit"; client: ManagementClient; onChanged: () => void }) {
  const operations = operationsFor(surface); const [operation, setOperation] = useState(operations[0]?.[0] ?? "");
  const definition = MANAGEMENT_OPERATIONS[operation]; const [args, setArgs] = useState<JsonObject>(() => defaults(definition));
  const [confirmed, setConfirmed] = useState(false); const [expectedVersion, setExpectedVersion] = useState<number | undefined>(undefined);
  const [idempotencyKey, setIdempotencyKey] = useState(() => key()); const [result, setResult] = useState<ManagementResult | null>(null);
  useEffect(() => { const next = MANAGEMENT_OPERATIONS[operation]; setArgs(defaults(next)); setConfirmed(false); setExpectedVersion(undefined); setIdempotencyKey(key()); setResult(null); }, [operation]);
  if (!definition) return null;
  const canSubmit = (!definition.requires_confirmation || confirmed) && (!definition.requires_expected_version || expectedVersion !== undefined);
  const submit = async () => { const next = await client.call(operation, args, { confirmed, expectedVersion, idempotencyKey }); setResult(next); if (next.state === "ready") onChanged(); };
  return <section className="panel management-console" aria-labelledby={`manage-${surface}`}>
    <div className="management-head"><div><p className="section-eyebrow">Controlled writes · public Core transport</p><h2 id={`manage-${surface}`}>Management operation</h2></div><span>{operations.length} catalog actions</span></div>
    <label className="management-field"><span>Operation</span><select value={operation} onChange={(event: { target: { value: string } }) => setOperation(event.target.value)}>{operations.map(([name]) => <option key={name}>{name}</option>)}</select></label>
    <div className="operation-meta"><span>Scope <code>{definition.required_scope}</code></span><span>Idempotency {definition.requires_idempotency ? "required" : "not required"}</span><span>Expected version {definition.requires_expected_version ? "required" : "not required"}</span></div>
    <div className="management-fields">{Object.entries(definition.arguments_schema.properties ?? {}).map(([name, schema]) => <div key={name}><ArgumentField name={name} schema={schema} value={args[name]} onChange={(value) => setArgs((current) => ({ ...current, [name]: value }))} /></div>)}</div>
    {definition.requires_expected_version ? <label className="management-field"><span>Expected version</span><input type="number" min="0" value={expectedVersion ?? ""} onChange={(event: { target: { value: string } }) => setExpectedVersion(event.target.value === "" ? undefined : Number(event.target.value))} /></label> : null}
    {definition.requires_idempotency ? <div className="idempotency-preview"><span>Idempotency key</span><code>{idempotencyKey}</code></div> : null}
    <div className={`impact-box ${definition.requires_confirmation ? "impact-box--high" : ""}`}><strong>{definition.requires_confirmation ? "High-impact confirmation required" : "Authoritative state change"}</strong><p>Core will evaluate <code>{operation}</code> using the displayed arguments and scope. The UI cannot override its decision.</p>
      {definition.requires_confirmation ? <label><input type="checkbox" checked={confirmed} onChange={(event: { target: { checked: boolean } }) => setConfirmed(event.target.checked)} /> I explicitly confirm this exact operation and its consequences.</label> : null}</div>
    <button className="primary-button" disabled={!canSubmit} onClick={() => void submit()}>Submit to Core</button>
    {result ? <ManagementOutcome result={result} /> : null}
  </section>;
}
function ArgumentField({ name, schema, value, onChange }: { name: string; schema: ValueSchema; value: JsonValue | undefined; onChange: (value: JsonValue) => void }) {
  const type = Array.isArray(schema.type) ? schema.type.find((item) => item !== "null") : schema.type;
  if (type === "object" || type === "array") return <label className="management-field"><span>{name}</span><textarea value={JSON.stringify(value ?? (type === "array" ? [] : {}), null, 2)} onChange={(event: { target: { value: string } }) => { try { onChange(JSON.parse(event.target.value) as JsonValue); } catch {} }} /></label>;
  if (type === "integer") return <label className="management-field"><span>{name}</span><input type="number" value={typeof value === "number" ? value : 0} onChange={(event: { target: { value: string } }) => onChange(Number(event.target.value))} /></label>;
  return <label className="management-field"><span>{name}{/secret/i.test(name) ? " (SecretRef only)" : ""}</span><input value={typeof value === "string" ? value : ""} onChange={(event: { target: { value: string } }) => onChange(event.target.value)} /></label>;
}
function ManagementOutcome({ result }: { result: ManagementResult }) {
  const ok = result.state === "ready"; const transportFailure = "message" in result; const code = ok ? "ACCEPTED" : transportFailure ? result.state.toUpperCase() : result.error.code;
  return <div className={`management-result ${ok ? "management-result--ok" : "management-result--error"}`} role="status"><strong>{code}</strong><p>{ok ? "Core accepted the controlled request." : transportFailure ? result.message : result.error.message}</p>
    <dl><div><dt>Request</dt><dd><code>{result.requestId}</code></dd></div><div><dt>Trace</dt><dd><code>{result.traceId}</code></dd></div><div><dt>Audit</dt><dd>{result.auditId ?? "not issued"}</dd></div></dl></div>;
}
function defaults(definition?: OperationDefinition): JsonObject {
  const result: JsonObject = {}; if (!definition) return result;
  for (const [name, schema] of Object.entries(definition.arguments_schema.properties ?? {})) {
    const type = Array.isArray(schema.type) ? schema.type.find((item) => item !== "null") : schema.type;
    result[name] = /secret_ref/.test(name) ? "secretref://example/reference" : name === "plugin_id" ? "example.echo" : name === "subject_id" ? "owner:local" : name === "capability" ? "example.echo" : type === "integer" ? 1 : type === "array" ? [] : type === "object" ? {} : name === "trust_zone" ? "trusted" : name === "outcome" ? "completed" : "example";
  } return result;
}
function key() { return `ui-${crypto.randomUUID()}`; }
