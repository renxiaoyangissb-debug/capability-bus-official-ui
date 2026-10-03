# U4 real-Core security boundary

U4 accepts only Core's six documented `CAPBUS_MANAGEMENT_*` bootstrap values and exact management
protocol `0.1.0-alpha.3`. The plugin backend, not browser JavaScript, adds the stable plugin identity,
credential ID/generation, and HMAC-SHA-256 signature to canonical sorted compact JSON. It neither
imports Core packages nor reads Core SQLite, private directories, or the owner credential.

The HTTP server is created only after a complete compatible bootstrap and binds only
`127.0.0.1` on an ephemeral port. A five-minute, single-use pairing URL creates a 30-minute
`HttpOnly; SameSite=Strict` in-memory cookie session. API requests require the exact loopback Origin;
management writes also require the session CSRF token. Responses apply CSP, frame denial,
content-type protection, no-referrer policy, same-origin resource policy, no-store API caching, and a
one-megabyte body limit. No credential is written to browser storage, source, fixtures, logs, static
assets, or HTTP responses.

Core remains the reference monitor. It rechecks lifecycle, interface kind, manifest `consumes`, Grant
scope/expiry, credential generation, timestamp, nonce, confirmation, idempotency, expected version,
and audit correlation. Grant revocation, stop, disable, removal, Core restart, and UI restart invalidate
or rotate the process credential.

This is an Alpha local boundary, not an OS sandbox or release-candidate security claim. Plain HTTP is
limited to IPv4 loopback, so the cookie cannot use `Secure`; support for remote access, TLS, proxying,
durable browser sessions, and protection from another malicious process running as the same OS user
remain out of scope.
