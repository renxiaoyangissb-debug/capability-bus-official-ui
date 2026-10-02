import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ContractViolation, parseRequestEnvelope, parseResultEnvelope } from "../build/test/src/contracts/guards.js";

const fixture = (path) => JSON.parse(readFileSync(`contracts/f1-core-78127bb/${path}`, "utf8"));

test("frozen request and result examples pass the consumer runtime guards", () => {
  assert.equal(parseRequestEnvelope(fixture("examples/valid/request-envelope.json")).capability, "example.echo");
  assert.equal(parseResultEnvelope(fixture("examples/valid/result-envelope.json")).ok, true);
  assert.equal(parseResultEnvelope(fixture("examples/errors/grant-provider-denied.json")).error.code, "GRANT_PROVIDER_DENIED");
});

test("inline secrets are rejected at the public request boundary", () => {
  assert.throws(() => parseRequestEnvelope(fixture("examples/invalid/request-inline-secret.json")), ContractViolation);
});

test("unknown fields and string booleans fail closed", () => {
  const unknown = fixture("examples/valid/result-envelope.json");
  unknown.unexpected = true;
  assert.throws(() => parseResultEnvelope(unknown), /unknown fields/);
  const coerced = fixture("examples/errors/grant-provider-denied.json");
  coerced.error.retryable = "false";
  assert.throws(() => parseResultEnvelope(coerced), /boolean/);
});

test("unknown protocol values fail as incompatible", () => {
  const result = fixture("examples/valid/result-envelope.json");
  result.protocol_version = "0.2.0";
  assert.throws(() => parseResultEnvelope(result), /Unsupported result protocol/);
});
