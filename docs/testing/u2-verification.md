# U2 offline verification evidence

Date: 2026-10-02 (Asia/Shanghai)

Baselines:

- UI U1: `562828ebb7a760066844c172c23b3b2200abae5a`
- Core F1: `78127bb9192aa6ddf8f15b544c553c149415c5a5`
- Protocol: `0.1.0-alpha.1`
- Platform U2 dispatch checkpoint: `9f3d16f3ec4ec692fb1e278fe17bec64284307a6`
- Platform interruption recovery checkpoint: `9b249853e83b39e5fb2d8ef834da097b08ffecc9`
- Platform reproducibility rejection checkpoint: `53a6470a02db0719de2063e0c1f1c71aa895586d`

No dependency fetch, real service access, Core checkout import, database access, credential use, or
public-network listener was used.

## Commands and results

```text
npm run contracts:check
  27 snapshot files and 6 reference identities matched frozen Core F1

npm run verify
  TypeScript typecheck passed
  22/22 Node tests passed
  Vite production build passed (22 modules)
  20 installed packages declared licenses
  12 source files plus plugin boundary policy passed

npm run package:plugin
  Vite production build passed
  31 package integrity entries generated
  31/31 packaged files verified
```

The U2-specific tests prove that the ready model calls exactly the seven F1 read capabilities, empty
results do not trigger invented detail calls, permission and general Core errors keep their stable
codes, and offline/incompatible/forbidden/error remain distinct states with trace IDs.

## Deterministic offline bootstrap correction

Platform rejected the first U2 candidate after a newly cached matching Lightning CSS binary changed
the bootstrap result from 19 to 20 packages and rewrote the lock. The corrected bootstrap no longer
solves dependency versions from cache. It reads exact versions and integrity values from the committed
lock, selects only entries matching the current platform, ignores extra cache entries, and runs
offline `npm ci` against an isolated cache.

Regression tests cover an extra matching-package version producing the identical plan, the required
`lightningcss-darwin-arm64@1.33.0` tarball being absent and failing explicitly, and cached content with
the wrong integrity failing explicitly. Clean-copy verification also runs:

```text
npm run bootstrap:offline
  20 locked cached packages installed for darwin/arm64
  package-lock.json unchanged

npm ci --offline --ignore-scripts --no-audit --no-fund
  20 packages installed from the complete committed lock
```

The corrected `package-lock.json` SHA-256 is
`c8ef2875aa4c2ae0e7c0a62dd4c9c0081f6527b6ea6194c108f6f5a73bef38e5`; it was byte-identical before
and after clean-copy bootstrap.

## Visual and interaction verification

A temporary Vite preview bound only to `127.0.0.1:4173` was used for local visual QA and stopped
immediately afterward. Dashboard, Plugins, Capabilities, Runtime, and Audit headings were all reached.
The mock selector visibly exercised loading, empty, offline, incompatible, permission-denied, and Core
error states. The browser console contained no warnings or errors.

The preview was development tooling only. The packaged plugin process remains HTTP-inert, as covered
by the plugin boundary test; U2 does not add a listener implementation.
