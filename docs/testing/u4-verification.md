# U4 verification evidence

Date: 2026-10-03 (Asia/Shanghai)

- UI baseline: `39b5904499c0ecfa0dff1d57683812c150e377e4`
- Exact refresh pair: UI `c3a641ffc22a21905753d68c2c87621c4354faee` and Core `4858520224a98b6528cb6cf47e7aa2e517bb62dc`
- Core runtime/package: `0.1.0-alpha.4`; UI package remains independently versioned at `0.1.0-alpha.1`
- Platform acceptance/recovery: `a429c2b`, `c123ed7`; joint audit/refresh dispatches: `669dd43`, `ebe4f7c`
- Capability protocol: `0.1.0-alpha.1`
- Management protocol: `0.1.0-alpha.3`

Targeted bridge and management tests passed 28/28 before the real fixture. After the configuration
schema was narrowed to the runtime's actual fixed values using supported public Schema keywords, the
focused bridge/management/plugin slice passed 9/9.

The real fixture command is:

```text
python3 scripts/verify-real-core.py ../capability-bus-core
```

It packages the plugin, creates an isolated Core root under the operating-system temporary directory,
uses only the Core CLI and public transports, and deletes the root afterward. It passed installation,
management and capability Grants, enable/start, public read/write, audit-bearing writes, idempotency
hit/conflict, expected-version success/conflict, confirmation denial/success, audit correlation, Grant
revocation, disable/remove, listener release, Core CLI independence, UI/Core restart and credential
reprovisioning, plus incompatible fail-closed behavior. No external network or real service was used.

The final T5 extension registers, grants, enables and starts Core's independent `example.echo` tool.
Its public command succeeds before UI disable, succeeds after UI disable in the same resident process,
and succeeds again after UI removal. At both lifecycle boundaries the former UI URL is unreachable;
Core CLI remains usable and the non-UI plugin reports healthy/resident. This closes joint acceptance
row 5 without adding UI runtime behavior or private state access.

Final candidate commands:

```text
npm run verify
npm run package:plugin
```

This evidence is an integration-gate result, not a release-candidate declaration.
