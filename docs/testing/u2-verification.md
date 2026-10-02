# U2 offline verification evidence

Date: 2026-10-02 (Asia/Shanghai)

Baselines:

- UI U1: `562828ebb7a760066844c172c23b3b2200abae5a`
- Core F1: `78127bb9192aa6ddf8f15b544c553c149415c5a5`
- Protocol: `0.1.0-alpha.1`
- Platform U2 dispatch checkpoint: `9f3d16f3ec4ec692fb1e278fe17bec64284307a6`
- Platform interruption recovery checkpoint: `9b249853e83b39e5fb2d8ef834da097b08ffecc9`

No dependency fetch, real service access, Core checkout import, database access, credential use, or
public-network listener was used.

## Commands and results

```text
npm run contracts:check
  27 snapshot files and 6 reference identities matched frozen Core F1

npm run verify
  TypeScript typecheck passed
  19/19 Node tests passed
  Vite production build passed (22 modules)
  19 installed packages declared licenses
  12 source files plus plugin boundary policy passed

npm run package:plugin
  Vite production build passed
  30 package integrity entries generated
  30/30 packaged files verified
```

The U2-specific tests prove that the ready model calls exactly the seven F1 read capabilities, empty
results do not trigger invented detail calls, permission and general Core errors keep their stable
codes, and offline/incompatible/forbidden/error remain distinct states with trace IDs.

## Visual and interaction verification

A temporary Vite preview bound only to `127.0.0.1:4173` was used for local visual QA and stopped
immediately afterward. Dashboard, Plugins, Capabilities, Runtime, and Audit headings were all reached.
The mock selector visibly exercised loading, empty, offline, incompatible, permission-denied, and Core
error states. The browser console contained no warnings or errors.

The preview was development tooling only. The packaged plugin process remains HTTP-inert, as covered
by the plugin boundary test; U2 does not add a listener implementation.
