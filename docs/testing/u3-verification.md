# U3 offline verification evidence

Date: 2026-10-03 (Asia/Shanghai)

- UI baseline: `f17320cf39f18d507a4e40b0f7047b88a14582ae`
- Core management authority: `272f6325506c4ce7c4de5c100fb3f03a28701318`
- Platform T4 verification: `048a2b0`
- Management protocol: `0.1.0-alpha.3`

The imported 12-file snapshot is hash-locked. Targeted tests cover the 42-operation catalog, surface
routing, explicit confirmation, expected version, idempotency, SecretRef-only input, correlation, and
distinct permission/version/idempotency/offline/incompatible/general error results.

Final commands:

```text
npm run verify
npm run package:plugin
```

Both run offline against fixtures and the two immutable contract snapshots. No real Core, credential,
secret value, database, private endpoint, or network service is used.
