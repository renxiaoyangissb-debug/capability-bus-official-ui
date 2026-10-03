# Changelog

## Unreleased (U3)

- Imported the 12-file management-v0.1 snapshot from Core `272f6325506c4ce7c4de5c100fb3f03a28701318`.
- Added a catalog-driven management client, deterministic fake, controlled write panels, explicit high-impact confirmation, optimistic concurrency, idempotency, SecretRef-only validation, and request/trace/audit correlation.
- Expanded the plugin manifest to the exact 42-operation public catalog without adding a real Core transport or listener.

## Unreleased (U2)

- Added read-only Dashboard, Plugins, Capabilities, Runtime, and Audit views.
- Added deterministic loading, empty, Core error, offline, protocol-incompatible, and permission-denied mock states.
- Added a typed U2 read model that consumes only the seven frozen F1 public capabilities.
- Kept lifecycle controls, capability invocation, Grant/configuration mutations, real Core access, and HTTP serving out of scope.
- Made offline bootstrap lock-driven and fail-closed for missing current-platform optional binaries.

## 0.1.0-alpha.1 (U1 development)

- Added independent project governance and pinned TypeScript/React/Vite skeleton.
- Added immutable Core F1 contract provenance and repeatable sync/check tooling.
- Added the public-envelope client, fake Core adapter, status/error/pagination handling, and tests.
- Added the HTTP-inert `ui.official.web` process package shell and static packaging boundary.
- Added loopback, Session/CSRF/Origin, SecretRef, license, and integrity policies without production-security claims.
