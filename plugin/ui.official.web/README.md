# ui.official.web U2 read-only package

This package remains intentionally inert with respect to HTTP. The F1 process entry performs only the
public stdio handshake and answers `ui.session.status`; it never binds a port. Static U2 assets provide
Dashboard, Plugins, Capabilities, Runtime, and Audit views backed by the frozen fake Core and are added
to `web/` by `npm run package:plugin`.

The views consume only the seven frozen F1 read capabilities declared in `plugin.yaml`. Registration,
Grant creation, lifecycle changes, configuration changes, capability invocation, and task control are
not exposed. U2 does not connect to a real Core and does not claim that pairing, cookie sessions,
CSRF, Origin enforcement, or HTTP serving is production-ready.
