# Capability Bus Official UI

`capability-bus-official-ui` is the independent `ui.official.web` interface plugin. This repository is
currently at **U2**: the U1 protocol/package boundary plus read-only Dashboard, Plugins, Capabilities,
Runtime, and Audit views driven exclusively by the deterministic frozen-F1 fake transport.

It is not a Core module. It does not import Core Python packages, read Core SQLite, keep a second
registry/Grant/configuration database, connect to a real Core, or expose a Web port.

## Frozen baseline

- UI start commit: `7365453781aecdf7909d8d46282c0d09e8050c3a`
- Core F1: `78127bb9192aa6ddf8f15b544c553c149415c5a5`
- Protocol: `0.1.0-alpha.1` (exact match in U1)
- Platform acceptance: `0597c869ac74e6532d343ab56c078ccf9e9f9c9d`

See [F1 provenance](docs/contracts/f1-provenance.md), [security boundary](docs/security/u1-security-boundary.md),
[dependencies](docs/dependencies.md), and [U1 completion](docs/u1-completion.md).

## Offline bootstrap and verification

When the exact locked tarballs already exist in the local npm content cache:

```bash
npm run bootstrap:offline
```

The bootstrap helper synthesizes a temporary read-only package index from those cached tarballs,
installs the exact dependency graph, and regenerates the standard registry-based lock without network
access. It fails if any required version is absent. Once dependencies are present:

```bash
npm run verify
npm run package:plugin
```

`verify` checks the 27 upstream contract hashes plus six pinned F1 reference identities, TypeScript
types, protocol/client/security/plugin tests, the Vite static build, dependency license declarations,
and architectural boundary policy. Tests use only fixtures and the local fake; they require no
network, credential, database, or Core checkout.

The built plugin package appears at `build/plugin/ui.official.web/` and includes static assets, a
dependency license inventory, and SHA-256 checksums. Production target machines do not run `npm install`.

## U2 read surface

The UI consumes only `system.status.get`, plugin list/inspect, capability list/describe, Grant list,
and audit list. Its mock-state control exercises loading, empty, Core error, offline, incompatible,
and permission-denied rendering without changing Core state. Runtime is deliberately a projection of
public status and plugin lifecycle fields; U2 does not invent process-control, log, or telemetry APIs.

U2 has no management writes, capability invocation, Grant/configuration editing, lifecycle controls,
real Core connection, or Web listener. Those remain behind U3, F2, and later integration gates. See
[U2 completion](docs/u2-completion.md) for the exact boundary.
