# Frozen F1 contract provenance

The protocol authority is **capability-bus-core**, not this repository.

| Field | Frozen value |
|---|---|
| Core commit | `78127bb9192aa6ddf8f15b544c553c149415c5a5` |
| Protocol | `0.1.0-alpha.1` |
| Source path | `contracts/v0.1/` |
| Local snapshot | `contracts/f1-core-78127bb/` |
| Compatibility | exact protocol value only; unknown versions fail closed |
| Acceptance | Platform `0597c869ac74e6532d343ab56c078ccf9e9f9c9d`, human response `接受 F1` |

The local directory is an immutable, generated consumer snapshot for offline builds and tests. It
must not be edited to define protocol behavior. `contracts/provenance.json` fixes every file hash.
`npm run contracts:check` verifies the local snapshot. `node scripts/sync-contracts.mjs <core-repo>`
will only resync from the exact frozen commit and refuses any differing commit argument.

The same provenance record pins Git blob and SHA-256 identities for the upstream fake Core,
conformance/runtime schema validator, public SDK contract parser, conformance tests, and T2 evidence.
They are references, not copied runtime dependencies. Contract sync verifies those identities directly
against the immutable Core commit; the UI implementation imports none of those Python modules.

F1 public read capabilities are:

- `system.status.get`
- `system.plugins.list`
- `system.plugins.inspect`
- `system.capabilities.list`
- `system.capabilities.describe`
- `system.grants.list`
- `system.audit.list`

Any other `system.*` capability is treated by the fake as `FAKE_MUTATION_NOT_APPLIED`. U1 does not
invent lifecycle, Grant, configuration, or invocation write APIs. Those remain deferred until Core
publishes and freezes them.

The source README at the frozen commit still says “candidate” because the acceptance record lives in
Platform governance. This repository records both facts without rewriting the upstream snapshot.
