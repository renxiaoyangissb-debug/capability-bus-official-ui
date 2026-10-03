# U4 completion and boundary

U4 replaces the production fake path with Core's accepted resident interface-plugin management
bootstrap at `c4fe12634571154a9d64ce97f8f9922dc14317b3`. The backend validates the bootstrap before
binding, signs the unchanged alpha.3 request semantics, and forwards the public
`capbus-local-control-v1` management envelope. The frozen fake remains only for deterministic tests.

The packaged plugin now provides an ephemeral loopback Web server, one-use pairing, in-memory browser
sessions, Origin/CSRF enforcement, static assets, live reads, and controlled writes. Core remains sole
authority for all registry, lifecycle, capability, Grant, configuration, invocation, idempotency, and
audit state. Page reloads and process restarts read authority from Core rather than a UI database.

The real integration fixture covers CLI registration, a Grant bound to the stable plugin system
identity, enable/start, public reads and writes, idempotency replay/conflict, configuration optimistic
concurrency, explicit confirmation, audit lookup, Grant revocation, disable/remove, listener release,
Core independence, UI restart/reprovision, Core restart/recovery, and incompatible bootstrap rejection.
The final T5 evidence additionally starts a resident non-UI plugin and successfully invokes it before
UI disable, after UI disable with the same resident process, and after UI removal, while the UI listener
and session authority remain gone.

Remaining Alpha limitations are the lack of an OS sandbox, loopback HTTP without TLS, in-memory
sessions, and fixed runtime defaults for port/session/audit-page configuration until Core publishes a
runtime configuration-delivery contract. U4 makes no release-candidate claim.
