# Capability Bus Official UI instructions

These instructions apply to the whole repository.

## Scope and authority

- This repository owns the `ui.official.web` interface-plugin implementation and package only.
- Core is the sole authority for protocol, plugin registry, capability ownership, Grants, configuration, lifecycle, invocation, idempotency, and audit state.
- Consume only versioned public Request/Result envelopes and public management capabilities. Never import Core Python packages, read Core SQLite, or call a private endpoint.
- Do not turn a vendored contract snapshot into a second protocol authority. Every snapshot must identify an immutable Core commit and exact file hashes and must pass `npm run contracts:check`.

## Stage gates

- U1 contains the reproducible engineering skeleton, system-plugin shell, frozen-protocol client, fake transport, boundary tests, and explicit security design interfaces.
- Do not add Dashboard, Plugins, Capabilities, Runtime, Audit, Grants, or Configuration product pages in U1.
- Do not add management mutations before the corresponding public Core contracts are frozen. F1 exposes only the read capabilities recorded in `docs/contracts/f1-provenance.md`.
- Do not connect to a real Core before the later integration gate.

## Security boundaries

- A process that is merely present, registered, unauthorized, disabled, or not explicitly started must not bind a port.
- Future HTTP serving is loopback-only and must fail closed on any non-`127.0.0.1` host.
- Do not store long-lived credentials in localStorage, sessionStorage, source, fixtures, logs, error details, or build output.
- Secret material never crosses the public UI boundary; only `secretref://` references may appear.
- Session, pairing, CSRF, and Origin code in U1 is a testable design boundary, not a production-security claim.

## Verification

The repository is offline-safe after dependencies are present:

```bash
npm run verify
npm run package:plugin
```

Never fetch dependencies or contact a real service as part of tests.
