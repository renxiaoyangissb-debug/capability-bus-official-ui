import test from "node:test";
import assert from "node:assert/strict";

import { assertLoopbackHost, authorizeBrowserRequest, secretRefForDisplay } from "../build/test/src/security/web-security.js";

async function digest(value) {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(data).toString("hex");
}

test("future serving is fixed to IPv4 loopback", () => {
  assert.doesNotThrow(() => assertLoopbackHost("127.0.0.1"));
  for (const host of ["0.0.0.0", "::", "::1", "localhost", "192.168.1.2"]) {
    assert.throws(() => assertLoopbackHost(host), /restricted/);
  }
});

test("session, Origin, and CSRF checks fail closed", async () => {
  const session = { subjectId: "owner:local", expiresAtEpochMs: 2_000, csrfTokenDigest: await digest("valid") };
  const base = { method: "POST", origin: "http://127.0.0.1:8123", expectedOrigin: "http://127.0.0.1:8123", csrfToken: "valid", session, nowEpochMs: 1_000 };
  assert.deepEqual(await authorizeBrowserRequest(base), { allowed: true });
  assert.equal((await authorizeBrowserRequest({ ...base, origin: "http://evil.invalid" })).code, "ORIGIN_DENIED");
  assert.equal((await authorizeBrowserRequest({ ...base, csrfToken: null })).code, "CSRF_REQUIRED");
  assert.equal((await authorizeBrowserRequest({ ...base, csrfToken: "replay" })).code, "CSRF_DENIED");
  assert.equal((await authorizeBrowserRequest({ ...base, nowEpochMs: 2_000 })).code, "SESSION_EXPIRED");
  assert.equal((await authorizeBrowserRequest({ ...base, session: null })).code, "SESSION_REQUIRED");
});

test("SecretRef display reveals a reference, never a secret value", () => {
  assert.deepEqual(secretRefForDisplay({ uri: "secretref://github/readonly" }), { configured: true, reference: "secretref://github/readonly" });
  assert.deepEqual(secretRefForDisplay({ value: "plaintext" }), { configured: false });
});
