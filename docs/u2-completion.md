# U2 completion and scope boundary

U2 adds five read-only product views on top of the independently verified U1 boundary:

- Dashboard summarizes the public Core status, plugin/capability totals, active Grant metadata, and
  current audit page.
- Plugins shows stable IDs, versions, Trust Zone, lifecycle state, and the public inspect result.
- Capabilities shows names, explicit query/command semantics, ownership, and the public describe result.
- Runtime projects only the Core status and public plugin lifecycle fields. It explicitly identifies
  PID, telemetry, logs, and controls as unavailable in F1.
- Audit shows decision metadata, reason codes, subject and trace references, timestamps, and payload
  key names without payload values.

The deterministic fake offers `ready`, `empty`, `error`, `offline`, `incompatible`, and `forbidden`
transport scenarios. The React surface also exposes a stable loading fixture. These states preserve
Core trace IDs and error codes; permission denial and protocol mismatch fail closed.

## Public contract proof

The U2 read model invokes exactly the seven F1 capabilities frozen in
[`f1-provenance.md`](contracts/f1-provenance.md):

```text
system.status.get
system.plugins.list
system.plugins.inspect
system.capabilities.list
system.capabilities.describe
system.grants.list
system.audit.list
```

The default fake shapes mirror the provenance-pinned upstream fake at Core commit
`78127bb9192aa6ddf8f15b544c553c149415c5a5`. Its audit fixture is the frozen valid audit-page example.
The vendored contract snapshot remains unchanged and is verified by `npm run contracts:check`.

## Explicit deferrals

U2 does not add mutation capabilities, lifecycle controls, capability invocation, Grant/configuration
editing, task control, a real Core transport, a browser session server, or an HTTP listener. It reads
no Core database or private API, imports no Core package, stores no authoritative control-plane state,
and handles no real credential or secret value. Those boundaries remain gated by U3, F2, and later
integration work.
