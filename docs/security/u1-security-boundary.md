# U1 security boundary and deferred controls

## Implemented in U1

- The plugin process shell opens no sockets. Merely having the package, registering it, or launching
  the F1 probe cannot create a Web listener.
- Future host configuration is schema-locked to `127.0.0.1`; the TypeScript boundary rejects every
  other host.
- Public payload validation rejects secret-like keys unless the value is a `secretref://` reference.
- There is no localStorage or sessionStorage credential path. The security interface accepts only an
  already-resolved, short-lived server-side session view.
- State-changing browser requests require an exact Origin and a CSRF token digest match. Safe methods
  still require an unexpired session and exact Origin.
- Error results preserve stable Core error codes and trace IDs; permission denial is not rewritten as
  success.

## Design contract for later HTTP serving

The browser session will be carried by a short-lived `HttpOnly; SameSite=Strict; Secure` cookie where
the local transport supports it. Pairing codes are single-use and short-lived. The server owns session
and CSRF material; browser JavaScript never receives a long-lived Core credential. CSP, frame denial,
content-type protection, strict Origin validation, request-size limits, and escaped untrusted strings
are required before real serving is enabled.

## Explicit non-claims and deferrals

U1 does not implement an HTTP server, pairing exchange, cookie issuance, session persistence, TLS,
real Core identity transport, or production-grade CSRF middleware. It does not claim an OS sandbox or
protection from a malicious local process. Real Core connection, listener lifecycle, port release,
pairing replay rejection, and browser security headers belong to later gates and require the frozen
local management channel.
