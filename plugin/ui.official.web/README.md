# ui.official.web U3 controlled-management package

This package remains intentionally inert with respect to HTTP. The F1 process entry performs only the
public stdio handshake and answers `ui.session.status`; it never binds a port. Static U2 assets provide
Dashboard, Plugins, Capabilities, Runtime, and Audit views backed by the frozen fake Core and are added
to `web/` by `npm run package:plugin`.

The views and controlled write panels consume only the 42 operations in the frozen alpha.3 management
catalog declared by `plugin.yaml`. High-impact operations require an unchecked-by-default explicit
confirmation; versioned and idempotent operations carry their required evidence. Secret values are
rejected. U3 does not connect to a real Core and does not claim that pairing, cookie sessions, CSRF,
Origin enforcement, or HTTP serving is production-ready.
