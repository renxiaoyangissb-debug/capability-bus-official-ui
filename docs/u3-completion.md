# U3 completion and boundary

U3 adds catalog-driven controlled writes to the existing Plugins, Capabilities, Runtime, and Audit
views. The Plugins panel covers lifecycle, trust, package rollback, configuration set/rollback,
SecretRef registration/revocation, and credential rotation. Capabilities covers Grant management and
capability calls. Runtime covers invocation cancellation, reconciliation, and cache cleanup. Audit
covers retention enforcement.

Every operation is selected from the frozen 42-operation catalog. Required idempotency keys are
generated and displayed before submission; expected versions are user supplied; high-impact
confirmation starts unchecked and must name the exact operation. Results display request, trace, and
audit correlation. Permission denial, version conflict, idempotency conflict, offline, incompatible,
and ordinary errors remain distinct.

The management identity, credential, signature, and responses are fixtures. No real credential,
secret value, Core connection, private endpoint, SQLite access, authoritative UI state, public bind,
or production Web-security claim is introduced. U3 does not enter or accept F2.
