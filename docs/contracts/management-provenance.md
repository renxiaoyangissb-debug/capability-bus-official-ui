# Frozen management contract provenance

Core is the protocol authority. UI U3 consumes the exact `contracts/management-v0.1` directory from
Core commit `272f6325506c4ce7c4de5c100fb3f03a28701318`, independently verified by Platform at
`048a2b0`. The protocol value is `0.1.0-alpha.3`.

`contracts/management-provenance.json` records the immutable commit, source and snapshot paths, and
SHA-256 for all 12 files. `npm run contracts:check` verifies both the original F1 snapshot and this
management snapshot. The UI imports only JSON contracts; it imports no Core Python module and reads no
Core database or private endpoint.

The operation catalog is the sole UI-facing write directory. U3 does not infer confirmation,
idempotency, concurrency, scope, arguments, result shape, or error behavior from operation names.
