# Management protocol candidate

`0.1.0-alpha.3` is the product-neutral local management candidate for U3. Requests are authenticated, replay-resistant, correlated by request/trace/audit identifiers, and carry optional optimistic-concurrency and explicit-confirmation evidence. This directory remains a candidate until independent Platform verification and human acceptance of an exact commit.

Secret values are forbidden. Only `secretref://` references may cross this boundary. Durable Task/Event behavior and product workflow remain system-plugin responsibilities.

`operations.json` is the authoritative UI-facing catalog. Every operation declares its mode, exact scope, idempotency, confirmation and optimistic-concurrency requirements, argument schema, success-data schema, and stable public error codes. High-impact CLI commands require an explicit `--confirm`; clients must never infer confirmation from the operation name.
