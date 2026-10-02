# Capability Bus contract v0.1 candidate

Status: **candidate pending human F1 acceptance**

Protocol value: `0.1.0-alpha.1`

Schema dialect: JSON Schema Draft 2020-12

These files describe the alpha.1 external values and are exercised by the conformance suite. They are not frozen until the F1 human checkpoint accepts a specific Core commit.

## Contract inventory

- `plugin-manifest.schema.json`: process-only package declaration, capabilities, permissions, resources and configuration schema reference.
- `request-envelope.schema.json`, `result-envelope.schema.json`, `event-envelope.schema.json`, `error-envelope.schema.json`: bus envelopes.
- `content-ref.schema.json`, `secret-ref.schema.json`: large-content and secret-reference boundaries.
- `capability-descriptor.schema.json`: explicit query/command semantics; behavior is never guessed from the capability name.
- `lifecycle.schema.json`: public lifecycle and trust-zone values.
- `grant.schema.json`: minimum subject/capability/provider binding, expiry and revoke status.
- `audit-page.schema.json`: metadata-only audit records and integer cursor pagination.
- `examples/valid`, `examples/invalid` and `examples/errors`: accepted values, rejected boundaries and structured error examples.

## Machine and runtime conformance

The offline conformance suite sends every example through both its JSON Schema and the matching runtime parser. `capability_bus_core.schema_validation` implements every keyword used by this candidate: local file `$ref`, JSON `type`, `required`, `additionalProperties`, `properties`, `enum`, `const`, `pattern`, `minLength`, `maxLength`, `minimum`, `items`, `minItems`, `uniqueItems`, `anyOf` and `date-time` format. It rejects unsupported schema keywords and remote or escaping references. No network or third-party schema package is used.

Runtime parsing adds semantic security checks that generic payload schemas do not express, including recursive inline-secret rejection. Consequently, the structurally valid `request-inline-secret.json` example passes its structural schema but is rejected by runtime conformance; the test records both outcomes rather than claiming the schema enforces that semantic rule.

## CLI mapping

The alpha.1 CLI uses these public semantics:

```text
capbus --root <path> init|doctor|version
capbus --root <path> plugin validate|register|list|inspect|enable|disable|start|stop|status|remove
capbus --root <path> capability list|describe|call
capbus --root <path> grant create|list|inspect|revoke
capbus --root <path> audit list|inspect
```

CLI JSON wraps successful output as `{"ok": true, "data": ...}` and command-processing failure as `{"ok": false, "error": ...}`. Capability invocation itself returns a `ResultEnvelope` inside `data`, so a denied plugin call is a successful CLI exchange containing `data.ok=false`.

Unknown plugins register as `quarantine + disabled`. A minimum Grant must exist before enable. Start performs a process handshake/readiness probe and marks the plugin logically healthy; alpha.1 capability calls use a fresh supervised one-shot process session and always clean it up. Resident process recovery is alpha.2 work.

The lifecycle vocabulary includes `discovered` and `registered` as architecture baseline states. In alpha.1 they describe transient validation/atomic-registration phases and are not persisted or emitted: a successful registration is committed directly as `quarantine + disabled`, while a failed registration creates no plugin row.

A Grant binds subject, capability and the stable system ID of its provider. Authorization compares all three against the current route before idempotency access or process start. A version replacement of the same logical plugin retains the system ID and its Grant; a different plugin taking over the capability receives a new system ID and the old Grant fails with `GRANT_PROVIDER_DENIED`.

Audit pagination accepts `limit` 1–200 and an integer `cursor`; `next_cursor` is null at the end. The next request returns records whose `audit_id` is greater than the cursor.

## Candidate public management capabilities

The fake Core supports the read surface needed for UI contract work:

- `system.status.get`
- `system.plugins.list`, `system.plugins.inspect`
- `system.capabilities.list`, `system.capabilities.describe`
- `system.grants.list`
- `system.audit.list`

Other `system.*` requests return `FAKE_MUTATION_NOT_APPLIED`. The real alpha.1 management implementation is CLI-local; a versioned local management channel and the complete write surface remain later Core work. Human F1 review must decide whether this read surface is sufficient to freeze for UI U1.

## Error codes exercised at alpha.1

```text
CAPABILITY_NOT_FOUND
GRANT_REQUIRED
GRANT_INVALID
GRANT_REVOKED
GRANT_EXPIRED
GRANT_SUBJECT_DENIED
GRANT_CAPABILITY_DENIED
GRANT_PROVIDER_DENIED
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_FINGERPRINT_CONFLICT
IDEMPOTENCY_IN_PROGRESS
PACKAGE_INTEGRITY_MISMATCH
RUNTIME_ENTRYPOINT_INVALID
PROTOCOL_HANDSHAKE_INVALID
PROTOCOL_INVALID
PROTOCOL_MESSAGE_TOO_LARGE
PROTOCOL_RESULT_INVALID
PLUGIN_TIMEOUT
PLUGIN_CRASHED
PROVIDER_EXECUTION_FAILED
RESOURCE_DISK_PRESSURE
RESOURCE_CONCURRENCY_LIMIT
```

Messages are safe summaries. Plugin-provided error text/details are not relayed by Core.

## Compatibility and deprecation candidate

- Adding an optional field with a defined default is backward compatible within v0.1.
- Removing a field, changing meaning/error semantics, or making an optional field required is breaking.
- After F1, a breaking change requires a new protocol version, migration note, updated examples/conformance suite and Core/UI compatibility record.
- A deprecated field remains accepted for at least the rest of the current Alpha protocol line unless a security issue requires earlier removal; such removal still requires an explicit version/migration record.
- Unknown protocol versions, unknown external fields at every declared object level and incompatible runtime types fail closed; strings are not coerced into booleans or integers.
