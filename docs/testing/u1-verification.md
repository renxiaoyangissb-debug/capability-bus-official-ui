# U1 offline verification evidence

Date: 2026-10-02 (Asia/Shanghai)

Frozen baselines:

- UI start: `7365453781aecdf7909d8d46282c0d09e8050c3a`
- Core F1: `78127bb9192aa6ddf8f15b544c553c149415c5a5`
- Platform recovery/authorization: `79df57b53f9d8cc580de40efd7719deab733f518`
- Protocol: `0.1.0-alpha.1`

Toolchain used: Node `26.9.0`, npm `11.19.1`, TypeScript `6.0.3`, Vite `8.2.0`, Python `3.9.6` for
the independent stdio plugin fixture. No dependency or service network access was used.

## Clean-copy proof

A new `/tmp` copy excluded `.git`, `node_modules`, `dist`, and `build`. The following completed there:

```text
node scripts/bootstrap-offline-cache.mjs
  19 cached packages locked and installed

npm run verify
  27 contract snapshot files + 6 upstream reference identities verified
  TypeScript typecheck passed
  15/15 Node tests passed
  Vite production build passed
  19/19 installed packages declared licenses
  11 source files plus plugin boundary policy passed

npm run package:plugin
  Vite production build passed
  30/30 package files matched SHA-256 checksums
```

The clean copy regenerated a byte-identical `package-lock.json`. Contract sync from the exact Core
commit regenerated a byte-identical `contracts/` tree and re-passed the provenance check.

The production static build contained one HTML file, one CSS asset, and one JavaScript asset. CSS
minification is deliberately disabled for the cached-native-package reason documented in
`docs/dependencies.md`; bundling itself is verified.

## Additional boundary evidence

The frozen Core conformance validator independently accepted `plugin/ui.official.web/plugin.yaml`.
This was a one-time read-only verification command against the exact Core checkout; UI source, build,
tests, and target package do not import Core modules or require that checkout.

The Core worktree contained concurrent T3 changes and was not modified. The Platform worktree was not
modified. U1 does not use their in-flight changes as evidence.

## License/release limitation

All installed packages declare a license. The `@rolldown/binding-darwin-arm64@1.2.1` tarball declares
MIT but omits a separate license text; the package records this explicitly. The UI project itself is
UNLICENSED until the owner selects a redistribution license, so public release remains blocked.
