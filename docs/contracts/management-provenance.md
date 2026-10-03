# Frozen management contract provenance

Core is the protocol authority. UI U3 consumes the exact `contracts/management-v0.1` directory from
Core commit `322503845cb322628fe2db7a2c570fc6289d22db`, independently accepted by Platform at
`a429c2b`. The protocol value remains `0.1.0-alpha.3`; the machine-readable 42-operation contract is
unchanged and the README adds the resident interface-plugin bootstrap.

`contracts/management-provenance.json` records the immutable commit, source and snapshot paths, and
SHA-256 for all 12 files. `npm run contracts:check` verifies both the original F1 snapshot and this
management snapshot. The UI imports only JSON contracts; it imports no Core Python module and reads no
Core database or private endpoint.

The operation catalog is the sole UI-facing write directory. U3 does not infer confirmation,
idempotency, concurrency, scope, arguments, result shape, or error behavior from operation names.
