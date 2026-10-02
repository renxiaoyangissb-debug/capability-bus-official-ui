# ui.official.web U1 package shell

This package is intentionally inert with respect to HTTP. The F1 process entry performs only the
public stdio handshake and answers `ui.session.status`; it never binds a port. Static assets are
added to `web/` by `npm run package:plugin`.

Registration, Grant creation, enablement, and start remain separate Core-owned actions. U1 does not
connect to a real Core and does not claim that pairing, cookie sessions, CSRF, or Origin enforcement
is production-ready.
