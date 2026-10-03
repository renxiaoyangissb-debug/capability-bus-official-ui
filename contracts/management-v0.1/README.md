# Management protocol candidate

`0.1.0-alpha.3` is the product-neutral local management candidate for U3. Requests are authenticated, replay-resistant, correlated by request/trace/audit identifiers, and carry optional optimistic-concurrency and explicit-confirmation evidence. This directory remains a candidate until independent Platform verification and human acceptance of an exact commit.

Secret values are forbidden. Only `secretref://` references may cross this boundary. Durable Task/Event behavior and product workflow remain system-plugin responsibilities.

`operations.json` is the authoritative UI-facing catalog. Every operation declares its mode, exact scope, idempotency, confirmation and optimistic-concurrency requirements, argument schema, success-data schema, and stable public error codes. High-impact CLI commands require an explicit `--confirm`; clients must never infer confirmation from the operation name.

## Interface-plugin bootstrap

An owner may grant an interface plugin one declared operation, or `system.*` bounded by its declared `consumes`, using the existing Grant shape. The Grant subject is `plugin:<plugin-system-id>`. Manifest declaration alone never authorizes an operation.

For an authorized resident interface process, Core injects `CAPBUS_MANAGEMENT_SOCKET`, `CAPBUS_MANAGEMENT_PROTOCOL_VERSION`, `CAPBUS_MANAGEMENT_IDENTITY_ID`, `CAPBUS_MANAGEMENT_CREDENTIAL_ID`, `CAPBUS_MANAGEMENT_CREDENTIAL_GENERATION`, and `CAPBUS_MANAGEMENT_HMAC_KEY`. Sign the canonical sorted compact UTF-8 JSON request without `signature` using HMAC-SHA-256, then send the unchanged request in the local-control `management` envelope. This requires no Core import, database access, private-directory access, or owner credential.

Core rechecks stable plugin identity, interface kind, healthy lifecycle, `consumes`, active Grant and expiry on every request. Revocation, disable, stop, removal, trust change, rollback, owner rotation, restart or reprovisioning invalidates old credentials.
