# Capability Bus Official UI

`capability-bus-official-ui` is the independent `ui.official.web` interface plugin. This repository is
currently at **U4**: the U2/U3 views and catalog-driven management actions now use the accepted Core
alpha.4 runtime/package with its alpha.3 resident interface-plugin management bootstrap. Capability
protocol remains alpha.1; the UI package remains independently versioned at `0.1.0-alpha.1`.

It is not a Core module. It does not import Core Python packages, read Core SQLite, keep a second
registry/Grant/configuration database, use the owner credential, or call a private Core endpoint. Its
Web listener exists only while an authorized resident plugin is explicitly running and binds an
ephemeral IPv4 loopback port.

## Frozen baseline

- UI start commit: `7365453781aecdf7909d8d46282c0d09e8050c3a`
- Core F1: `78127bb9192aa6ddf8f15b544c553c149415c5a5`
- Protocol: `0.1.0-alpha.1` (exact match in U1)
- Platform acceptance: `0597c869ac74e6532d343ab56c078ccf9e9f9c9d`

See [F1 provenance](docs/contracts/f1-provenance.md), [security boundary](docs/security/u1-security-boundary.md),
[dependencies](docs/dependencies.md), and [U1 completion](docs/u1-completion.md).

## Offline bootstrap and verification

When every package selected by the committed lock for the current platform already exists in the local
npm content cache:

```bash
npm run bootstrap:offline
```

The bootstrap helper treats `package-lock.json` as the only resolution authority, copies only those
exact tarballs into an isolated temporary cache, and runs offline `npm ci`. Extra cached versions are
ignored. A missing current-platform optional binary or integrity mismatch fails closed, and the helper
also fails if npm changes the lock. The complete lock supports the equivalent standard command
`npm ci --offline --ignore-scripts --no-audit --no-fund` when the same tarballs are cached. Once
dependencies are present:

```bash
npm run verify
npm run package:plugin
```

`verify` checks the 27 upstream contract hashes plus six pinned F1 reference identities, TypeScript
types, protocol/client/security/plugin tests, the Vite static build, dependency license declarations,
and architectural boundary policy. Unit tests use generated credentials and local fixtures; they
require no external network or service. The separate `scripts/verify-real-core.py` fixture pins an
exact local Core commit.

The built plugin package appears at `build/plugin/ui.official.web/` and includes static assets, a
dependency license inventory, and SHA-256 checksums. Production target machines do not run `npm install`.

## U4 real-Core surface

The browser talks only to the plugin's same-origin loopback backend. The backend injects Core's scoped
plugin identity into an unsigned browser request, signs the canonical request with its short-lived
process credential, and sends the public management envelope over Core's supplied Unix socket. Core
credentials never enter browser state, storage, responses, or static assets.

The UI exposes only operations declared by the frozen management catalog. Required idempotency keys,
expected versions and explicit confirmation are enforced before transport; SecretRef values may cross
the boundary but secret values may not. See [U4 completion](docs/u4-completion.md) and
[U4 security boundary](docs/security/u4-security-boundary.md) for the exact scope and limitations.
Install, upgrade, backup-based downgrade, disable and removal procedures are documented in the
[Official UI lifecycle runbook](docs/runbooks/official-ui-lifecycle.md).
