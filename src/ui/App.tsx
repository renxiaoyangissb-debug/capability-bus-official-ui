import { useEffect, useState } from "react";

import { EnvelopeClient } from "../client/envelope-client.js";
import { FakeCoreTransport, type FakeCoreScenario } from "../client/fake-core.js";
import { PROTOCOL_VERSION, type JsonObject } from "../contracts/types.js";
import type { ManagementScenario } from "../management/fake.js";
import { ManagementConsole } from "./ManagementConsole.js";
import {
  PAGE_COPY, arrayStrings, booleanField, compactId, formatTimestamp, loadManagementSnapshot,
  numberField, stringField, type ManagementSnapshot, type PageId, type SurfaceState
} from "./model.js";

type DemoScenario = FakeCoreScenario | ManagementScenario | "loading";

const pages: Array<{ id: PageId; label: string; glyph: string }> = [
  { id: "dashboard", label: "Dashboard", glyph: "⌁" },
  { id: "plugins", label: "Plugins", glyph: "◇" },
  { id: "capabilities", label: "Capabilities", glyph: "⌘" },
  { id: "runtime", label: "Runtime", glyph: "◌" },
  { id: "audit", label: "Audit", glyph: "≋" }
];

const scenarios: Array<{ value: DemoScenario; label: string }> = [
  { value: "ready", label: "Ready" }, { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" }, { value: "error", label: "Core error" },
  { value: "offline", label: "Core offline" }, { value: "incompatible", label: "Incompatible" },
  { value: "forbidden", label: "Permission denied" }
  ,{ value: "version_conflict", label: "Version conflict" }, { value: "idempotency_conflict", label: "Idempotency conflict" }
];

export function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [scenario, setScenario] = useState<DemoScenario>("ready");
  const [reloadKey, setReloadKey] = useState(0);
  const [surface, setSurface] = useState<SurfaceState>({ state: "loading" });

  useEffect(() => {
    let active = true;
    setSurface({ state: "loading" });
    if (scenario === "loading") return () => { active = false; };
    const readScenario: FakeCoreScenario = scenario === "version_conflict" || scenario === "idempotency_conflict" ? "ready" : scenario;
    const client = new EnvelopeClient(new FakeCoreTransport(readScenario), { subjectId: "ui.official.web:viewer" });
    void loadManagementSnapshot(client).then((next) => { if (active) setSurface(next); });
    return () => { active = false; };
  }, [scenario, reloadKey]);

  const copy = PAGE_COPY[page];
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Capability Bus</strong><small>Official interface</small></span>
        </div>
        <nav className="primary-nav">
          <p className="nav-label">Observe</p>
          {pages.map((item) => (
            <button className="nav-item" data-active={page === item.id ? "true" : "false"}
              aria-current={page === item.id ? "page" : undefined} key={item.id} onClick={() => setPage(item.id)}>
              <span className="nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="boundary-card"><span aria-hidden="true">⌾</span><div><strong>Read-only boundary</strong><p>F1 public capabilities only</p></div></div>
        <div className="connection-card">
          <span className={`connection-dot connection-dot--${surface.state}`} aria-hidden="true" />
          <div><strong>{connectionLabel(surface.state)}</strong><small>Frozen fake Core</small></div>
        </div>
      </aside>

      <main className="main-panel" id="main-content">
        <header className="topbar">
          <div className="title-group"><p className="section-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.description}</p></div>
          <div className="topbar-actions">
            <label className="scenario-control"><span>Mock state</span>
              <select value={scenario} onChange={(event: { target: { value: string } }) => setScenario(event.target.value as DemoScenario)}>
                {scenarios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <button className="icon-button" aria-label="Reload frozen Core reads" onClick={() => setReloadKey((value) => value + 1)}>↻</button>
            <span className="alpha-badge">Alpha</span>
          </div>
        </header>
        <div className="content-wrap" aria-live="polite" aria-busy={surface.state === "loading"}>
          {surface.state === "loading" ? <LoadingState /> : null}
          {surface.state !== "loading" && surface.state !== "ready" ? <FailureState state={surface} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
          {surface.state === "ready" ? <ReadyPage page={page} snapshot={surface.snapshot} scenario={scenario === "loading" || scenario === "empty" ? "ready" : scenario} /> : null}
        </div>
      </main>
    </div>
  );
}

function ReadyPage({ page, snapshot, scenario }: { page: PageId; snapshot: ManagementSnapshot; scenario: ManagementScenario }) {
  switch (page) {
    case "dashboard": return <Dashboard snapshot={snapshot} />;
    case "plugins": return <Plugins snapshot={snapshot} scenario={scenario} />;
    case "capabilities": return <Capabilities snapshot={snapshot} scenario={scenario} />;
    case "runtime": return <Runtime snapshot={snapshot} scenario={scenario} />;
    case "audit": return <Audit snapshot={snapshot} scenario={scenario} />;
  }
}

function Dashboard({ snapshot }: { snapshot: ManagementSnapshot }) {
  const healthy = snapshot.plugins.filter((plugin) => stringField(plugin, "lifecycle_state") === "healthy").length;
  const activeGrants = snapshot.grants.filter((grant) => stringField(grant, "status") === "active").length;
  return <div className="page-stack">
    <section className="hero-card">
      <div><div className="hero-status"><span className="pulse-dot" /> Core reports {stringField(snapshot.status, "status", "unknown")}</div>
        <h2>The control plane is visible.<br /><span>Authority stays with Core.</span></h2>
        <p>This U2 surface projects versioned public results. It holds no registry, Grant, configuration, or audit authority.</p></div>
      <div className="core-stamp"><span>Core build</span><strong>{stringField(snapshot.status, "version")}</strong><small>Protocol {PROTOCOL_VERSION}</small></div>
    </section>
    <section className="metric-grid" aria-label="System totals">
      <MetricCard label="Registered plugins" value={snapshot.plugins.length} note={`${healthy} healthy`} accent="mint" />
      <MetricCard label="Capabilities" value={snapshot.capabilities.length} note="public routes" accent="blue" />
      <MetricCard label="Active grants" value={activeGrants} note="Core-owned" accent="amber" />
      <MetricCard label="Audit records" value={snapshot.auditItems.length} note="current page" accent="violet" />
    </section>
    <div className="split-grid">
      <section className="panel"><PanelHeading eyebrow="Recent decisions" title="Audit pulse" tag="Metadata only" />
        {snapshot.auditItems.length === 0 ? <InlineEmpty title="No audit records" body="The frozen fake returned an empty audit page." /> :
          <ol className="activity-list">{snapshot.auditItems.slice(0, 3).map((item) => <li key={numberField(item, "audit_id") ?? stringField(item, "trace_id")}>
            <DecisionMark decision={stringField(item, "decision")} /><div><strong>{stringField(item, "capability")}</strong><span>{stringField(item, "subject_id")} · {stringField(item, "reason_code")}</span></div>
            <time>{formatTimestamp(stringField(item, "created_at"))}</time></li>)}</ol>}
      </section>
      <section className="panel boundary-panel"><PanelHeading eyebrow="Gate posture" title="U2 limits" />
        <ul className="check-list"><li><span>✓</span><div><strong>Frozen F1 reads</strong><small>Seven allow-listed capabilities</small></div></li>
          <li><span>✓</span><div><strong>Mock transport</strong><small>No real Core connection</small></div></li>
          <li><span>✓</span><div><strong>HTTP inert</strong><small>No listener started by this UI</small></div></li>
          <li className="check-list--locked"><span>—</span><div><strong>Mutations locked</strong><small>Deferred to U3 and F2</small></div></li></ul>
      </section>
    </div><TraceStrip traceId={snapshot.traces.status} label="Status read" />
  </div>;
}

function Plugins({ snapshot, scenario }: { snapshot: ManagementSnapshot; scenario: ManagementScenario }) {
  if (snapshot.plugins.length === 0) return <EmptyState kind="plugins" />;
  return <div className="page-stack">
    <SummaryLine count={snapshot.plugins.length} noun="registered provider" copy="Lifecycle and trust are separate signals. Trusted never means unrestricted." />
    <section className="panel table-panel"><div className="table-toolbar"><PanelHeading eyebrow="Registry result" title="Installed plugins" /><ReadOnlyTag /></div>
      <div className="table-scroll"><table><caption className="sr-only">Plugins returned by system.plugins.list</caption>
        <thead><tr><th>Plugin</th><th>Version</th><th>Trust zone</th><th>Lifecycle</th><th>System identity</th></tr></thead>
        <tbody>{snapshot.plugins.map((plugin) => <tr key={stringField(plugin, "system_id")}>
          <td><div className="primary-cell"><span className="plugin-avatar" aria-hidden="true">E</span><strong>{stringField(plugin, "plugin_id")}</strong></div></td>
          <td><code>{stringField(plugin, "active_version")}</code></td><td><StatusPill value={stringField(plugin, "trust_zone")} /></td>
          <td><StatusPill value={stringField(plugin, "lifecycle_state")} /></td><td><code title={stringField(plugin, "system_id")}>{compactId(stringField(plugin, "system_id"))}</code></td>
        </tr>)}</tbody></table></div>
    </section>
    {snapshot.pluginDetail ? <DetailPanel title="Frozen inspect result" value={snapshot.pluginDetail} /> : null}
    <ManagementConsole surface="plugins" scenario={scenario} /><TraceStrip traceId={snapshot.traces.plugins} label="Plugin registry read" />
  </div>;
}

function Capabilities({ snapshot, scenario }: { snapshot: ManagementSnapshot; scenario: ManagementScenario }) {
  if (snapshot.capabilities.length === 0) return <EmptyState kind="capabilities" />;
  return <div className="page-stack">
    <SummaryLine count={snapshot.capabilities.length} noun="published route" copy="Operation semantics come from descriptors, never from guessed capability names." />
    <div className="capability-grid">{snapshot.capabilities.map((capability) => {
      const name = stringField(capability, "capability"); const domain = name.split(".")[0] ?? "unknown";
      return <article className="capability-card" key={name}>
        <div className="capability-card__top"><span className="domain-mark">{domain.slice(0, 2).toUpperCase()}</span><StatusPill value={stringField(capability, "operation")} /></div>
        <h2>{name}</h2><dl className="record-list"><div><dt>Provider</dt><dd>{stringField(capability, "plugin_id")}</dd></div>
          <div><dt>Owner</dt><dd><code title={stringField(capability, "owner_system_id")}>{compactId(stringField(capability, "owner_system_id"))}</code></dd></div></dl>
        <div className="locked-action"><span aria-hidden="true">⌁</span> Invocation is outside U2</div>
      </article>;
    })}</div>
    {snapshot.capabilityDetail ? <DetailPanel title="Frozen describe result" value={snapshot.capabilityDetail} /> : null}
    <ManagementConsole surface="capabilities" scenario={scenario} /><TraceStrip traceId={snapshot.traces.capabilities} label="Capability catalog read" />
  </div>;
}

function Runtime({ snapshot, scenario }: { snapshot: ManagementSnapshot; scenario: ManagementScenario }) {
  if (snapshot.plugins.length === 0) return <EmptyState kind="runtime" />;
  return <div className="page-stack">
    <section className="runtime-banner"><span className="runtime-orbit" aria-hidden="true"><i /></span>
      <div><p>Core status</p><h2>{stringField(snapshot.status, "status", "unknown")}</h2><span>Version {stringField(snapshot.status, "version")}</span></div>
      <StatusPill value={booleanField(snapshot.status, "fake") ? "fake transport" : "public transport"} /></section>
    <section className="panel"><div className="table-toolbar"><PanelHeading eyebrow="Public lifecycle projection" title="Runtime instances" /><ReadOnlyTag /></div>
      <div className="runtime-list">{snapshot.plugins.map((plugin) => <article key={stringField(plugin, "system_id")}>
        <span className="runtime-state-line" aria-hidden="true" /><div><strong>{stringField(plugin, "plugin_id")}</strong><code>{stringField(plugin, "active_version")}</code></div>
        <div><small>Lifecycle</small><StatusPill value={stringField(plugin, "lifecycle_state")} /></div><div><small>Trust</small><StatusPill value={stringField(plugin, "trust_zone")} /></div>
        <p>PID, resource telemetry, logs, and controls are not present in frozen F1.</p></article>)}</div>
    </section>
    <section className="gate-note"><span aria-hidden="true">⌁</span><div><strong>Runtime control is intentionally unavailable</strong><p>Start, stop, restart, logs, and task controls require later frozen contracts. This page never synthesizes them.</p></div></section>
    <ManagementConsole surface="runtime" scenario={scenario} /><TraceStrip traceId={snapshot.traces.status} label="Runtime source read" />
  </div>;
}

function Audit({ snapshot, scenario }: { snapshot: ManagementSnapshot; scenario: ManagementScenario }) {
  if (snapshot.auditItems.length === 0) return <EmptyState kind="audit" />;
  return <div className="page-stack">
    <SummaryLine count={snapshot.auditItems.length} noun="metadata record" copy="Payload values, prompts, file contents, and secret material are never part of this view." />
    <section className="panel table-panel"><div className="table-toolbar"><PanelHeading eyebrow="Current cursor page" title="Decision log" /><span className="cursor-tag">Next cursor: {snapshot.nextAuditCursor ?? "end"}</span></div>
      <div className="audit-list">{snapshot.auditItems.map((item) => { const decision = stringField(item, "decision"); return <article key={numberField(item, "audit_id") ?? stringField(item, "trace_id")}>
        <div className="audit-index">#{numberField(item, "audit_id") ?? "—"}</div><DecisionMark decision={decision} />
        <div className="audit-main"><div><strong>{stringField(item, "capability")}</strong><StatusPill value={decision} /></div><p>{stringField(item, "subject_id")} · {stringField(item, "reason_code")}</p>
          <div className="audit-refs"><code title={stringField(item, "trace_id")}>{compactId(stringField(item, "trace_id"))}</code><span>{arrayStrings(item, "payload_keys").length} payload key(s)</span></div></div>
        <time>{formatTimestamp(stringField(item, "created_at"))}</time></article>; })}</div>
    </section><ManagementConsole surface="audit" scenario={scenario} /><TraceStrip traceId={snapshot.traces.audit} label="Audit page read" />
  </div>;
}

function LoadingState() { return <section className="state-panel state-panel--loading" role="status"><div className="loader" aria-hidden="true"><span /><span /><span /></div>
  <p className="section-eyebrow">Public read in progress</p><h2>Waiting for frozen Core results</h2><p>Loading is explicit; cached authority is never presented as live.</p>
  <div className="skeleton-lines" aria-hidden="true"><i /><i /><i /></div></section>; }

function FailureState({ state, onRetry }: { state: Exclude<SurfaceState, { state: "loading" } | { state: "ready" }>; onRetry: () => void }) {
  const content = failureCopy(state); const code = state.state === "forbidden" || state.state === "error" ? state.error.code : state.state.toUpperCase();
  return <section className={`state-panel state-panel--${state.state}`} role="alert"><div className="state-symbol" aria-hidden="true">{content.symbol}</div>
    <p className="section-eyebrow">{code}</p><h2>{content.title}</h2><p>{content.body}</p>
    <dl className="failure-meta"><div><dt>Trace</dt><dd><code>{compactId(state.traceId)}</code></dd></div><div><dt>Authority</dt><dd>Core response preserved</dd></div></dl>
    <button className="primary-button" onClick={onRetry}>Retry public reads</button></section>;
}

function EmptyState({ kind }: { kind: "plugins" | "capabilities" | "runtime" | "audit" }) {
  const copy = { plugins: ["No plugins registered", "Core returned an empty plugin list. Nothing is inferred from local files or cache."],
    capabilities: ["No capabilities published", "The public routing catalog is empty for this frozen result."],
    runtime: ["No runtime projection", "Runtime rows appear only when public plugin lifecycle data exists."],
    audit: ["No audit metadata", "This cursor page contains no audit records. No cached history is substituted."] }[kind];
  return <section className="state-panel state-panel--empty"><div className="empty-rings" aria-hidden="true"><i /><i /><i /></div>
    <p className="section-eyebrow">Empty result</p><h2>{copy[0]}</h2><p>{copy[1]}</p></section>;
}

function SummaryLine({ count, noun, copy }: { count: number; noun: string; copy: string }) { return <section className="summary-line"><div><strong>{count}</strong><span>{noun}{count === 1 ? "" : "s"}</span></div><p>{copy}</p></section>; }
function InlineEmpty({ title, body }: { title: string; body: string }) { return <div className="inline-empty"><span aria-hidden="true">○</span><div><strong>{title}</strong><p>{body}</p></div></div>; }
function MetricCard({ label, value, note, accent }: { label: string; value: number; note: string; accent: string }) { return <article className={`metric-card metric-card--${accent}`}><span>{label}</span><strong>{value.toString().padStart(2, "0")}</strong><small>{note}</small></article>; }
function PanelHeading({ eyebrow, title, tag }: { eyebrow: string; title: string; tag?: string }) { return <div className="panel-heading"><p>{eyebrow}</p><h2>{title}</h2>{tag ? <span>{tag}</span> : null}</div>; }
function ReadOnlyTag() { return <span className="read-only-tag"><span aria-hidden="true">⌁</span> Read only</span>; }
function StatusPill({ value }: { value: string }) { const tone = /healthy|active|allow|query|public/.test(value) ? "positive" : /failed|deny|error/.test(value) ? "negative" : /quarantine|command|fake/.test(value) ? "caution" : "neutral";
  return <span className={`status-pill status-pill--${tone}`}><i aria-hidden="true" />{value}</span>; }
function DecisionMark({ decision }: { decision: string }) { return <span className={`decision-mark decision-mark--${decision}`} aria-label={`Decision: ${decision}`}>{decision === "allow" ? "✓" : decision === "deny" ? "×" : "!"}</span>; }
function TraceStrip({ traceId, label }: { traceId: string; label: string }) { return <footer className="trace-strip"><span>{label}</span><code title={traceId}>{traceId}</code><small>Stable Core correlation</small></footer>; }

function DetailPanel({ title, value }: { title: string; value: JsonObject }) { return <section className="panel detail-panel"><div><p className="section-eyebrow">Public detail capability</p><h2>{title}</h2><p>No local enrichment or private state.</p></div>
  <dl className="detail-grid">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{displayValue(item)}</dd></div>)}</dl></section>; }
function displayValue(value: unknown): string { if (value === null) return "none"; if (["string", "number", "boolean"].includes(typeof value)) return String(value); if (Array.isArray(value)) return value.map(String).join(", "); if (typeof value === "object") return JSON.stringify(value); return "—"; }
function connectionLabel(state: SurfaceState["state"]): string { return ({ loading: "Reading Core", ready: "Fixture connected", offline: "Core offline", incompatible: "Protocol blocked", forbidden: "Grant required", error: "Core error" })[state]; }
function failureCopy(state: Exclude<SurfaceState, { state: "loading" } | { state: "ready" }>) { switch (state.state) {
  case "offline": return { symbol: "⌁", title: "Core is offline", body: state.message };
  case "incompatible": return { symbol: "≠", title: "Protocol mismatch", body: `${state.message}. The UI failed closed without rendering untrusted data.` };
  case "forbidden": return { symbol: "⊘", title: "Read access denied", body: `${state.error.message}. The denial remains a denial and retains its Core trace.` };
  case "error": return { symbol: "!", title: "Core returned an error", body: state.error.message };
} }
