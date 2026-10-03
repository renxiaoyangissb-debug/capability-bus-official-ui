# Official UI Alpha lifecycle runbook

This is an offline operator procedure for the exact reviewed Core/UI pair, not a release-candidate
claim. Core remains authoritative for plugin identity, Grants, configuration, lifecycle and audit.
Never edit Core SQLite or private credential files directly.

## Build and verify the package

From a clean, reviewed Official UI commit with the locked npm artifacts already cached:

```bash
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run verify
npm run package:plugin
```

Preserve the UI commit, package directory, `checksums.json`, dependency license inventory and the
accepted Core commit together. `scripts/verify-real-core.py` must pass against that exact clean Core
checkout before operator use. Do not install dependencies or download code on the target machine.

## Install, authorize and start

Use an explicit Core root and the packaged `build/plugin/ui.official.web` directory:

```bash
capbus --root <core-root> plugin validate <official-ui-package>
capbus --root <core-root> plugin register <official-ui-package>
capbus --root <core-root> plugin inspect ui.official.web
capbus --root <core-root> grant create --subject plugin:<plugin-system-id> --plugin ui.official.web --capability system.*
capbus --root <core-root> grant create --plugin ui.official.web --capability ui.session.status
capbus --root <core-root> plugin enable ui.official.web
capbus --root <core-root> plugin start ui.official.web
```

`system.*` is explicit owner authority bounded by the manifest's frozen `consumes`; use individual
operation Grants when a narrower UI is sufficient. The `ui.session.status` Grant is separate. Invoke
that capability with its returned Grant ID to obtain the short-lived one-use pairing URL. Registration
alone, missing management authority, or incompatible protocols must not create a listener.

## Upgrade

1. Record the current UI/Core commits, package checksum, active UI version, plugin system identity,
   current management/capability Grant IDs, `config get`, `config history`, and relevant audit IDs.
2. Stop the UI and confirm its loopback URL is unreachable. Browser sessions are intentionally
   in-memory and are not backed up.
3. Follow Core's lifecycle runbook to make an owner-only full-root backup containing authoritative
   state/configuration and private credentials. Keep the old UI package and checksums separately.
4. Build and verify the new UI in a new clean target. Run its real-Core verifier against the exact
   documented Core commit and a disposable root. Check capability and management protocol
   compatibility; package-version similarity alone is insufficient.
5. Validate and register the new package only after the old UI is stopped. Review manifest and
   `consumes` differences. Never silently widen Grants; create or revoke them explicitly through CLI.
6. Enable/start, obtain a new pairing session, then verify version/status, plugin inventory, Grants,
   UI configuration/history and audit correlation before declaring the operator switch complete.

Keep the old package and pre-upgrade Core-root backup until independent acceptance. Unknown contracts,
package-integrity failures, configuration validation failures or missing Grants fail closed.

## Downgrade or rollback

Use `plugin versions` and the exact recorded package digest. A package rollback is permitted only when
the older UI/Core protocol pair and configuration schema are documented compatible:

```bash
capbus --root <core-root> plugin stop ui.official.web
capbus --root <core-root> plugin rollback ui.official.web <recorded-version> --confirm
```

Inspect the returned lifecycle state and explicitly enable/start as required. If Core state or the UI
configuration schema changed incompatibly, stop Core and restore the matching pre-upgrade full-root
backup atomically with the older code/package. Never run older code against undocumented newer state,
edit SQLite, rewrite configuration history, or copy credential material between roots. Without a
compatible backup, retain the state for inspection and fail closed.

## Disable and remove

Revoke UI management Grants when authority should end, then disable and optionally remove:

```bash
capbus --root <core-root> grant revoke <ui-management-grant-id>
capbus --root <core-root> plugin disable ui.official.web
capbus --root <core-root> plugin remove ui.official.web --confirm
```

Disable/remove terminates the UI process, closes the loopback listener, destroys in-memory pairing and
browser sessions, and invalidates the process management credential. Verify the old URL is unreachable.
Removing package files is a separate explicit filesystem action after integrity/audit retention needs
are satisfied. Core may retain authoritative audit and lifecycle history according to its policy.

Core and unrelated plugins must remain available throughout UI disable/removal. Confirm with `version`,
`doctor`, and a real invocation of an already-running non-UI plugin—not only a status read. UI removal
must never delete, migrate or become the authority for Core/non-UI state.

Alpha limitations remain: no OS sandbox, no remote access/TLS, in-memory browser sessions, no automatic
backup, and no package-signing trust chain. Follow the matching Core lifecycle runbook for Core-root
backup, migration and uninstall procedures.
