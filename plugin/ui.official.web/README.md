# ui.official.web U4 real-Core package

The resident interface process accepts Core's public alpha.3 management bootstrap, signs canonical
requests in the backend, and connects only to the supplied Unix socket. It binds an ephemeral
`127.0.0.1` HTTP port only after Core explicitly starts the authorized plugin. `ui.session.status`
returns a short-lived, one-use pairing URL for the local operator.

The views and controlled write panels consume only the 42 operations in the frozen alpha.3 management
catalog declared by `plugin.yaml`. High-impact operations require an unchecked-by-default explicit
confirmation; versioned and idempotent operations carry their required evidence. Secret values are
rejected. The browser receives a short-lived HttpOnly session cookie and CSRF token, never Core's HMAC
credential. Origin checks, CSP, frame denial, body limits, and loopback-only binding fail closed.
