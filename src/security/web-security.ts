export const LOOPBACK_HOST = "127.0.0.1";

export interface SessionView {
  subjectId: string;
  expiresAtEpochMs: number;
  csrfTokenDigest: string;
}

export type SecurityDecision =
  | { allowed: true }
  | { allowed: false; code: "SESSION_REQUIRED" | "SESSION_EXPIRED" | "ORIGIN_DENIED" | "CSRF_REQUIRED" | "CSRF_DENIED" };

export function assertLoopbackHost(host: string): void {
  if (host !== LOOPBACK_HOST) throw new Error("Alpha HTTP serving is restricted to 127.0.0.1");
}

export async function authorizeBrowserRequest(input: {
  method: string;
  origin: string | null;
  expectedOrigin: string;
  csrfToken: string | null;
  session: SessionView | null;
  nowEpochMs?: number;
}): Promise<SecurityDecision> {
  if (input.session === null) return { allowed: false, code: "SESSION_REQUIRED" };
  if (input.session.expiresAtEpochMs <= (input.nowEpochMs ?? Date.now())) return { allowed: false, code: "SESSION_EXPIRED" };
  if (input.origin !== input.expectedOrigin) return { allowed: false, code: "ORIGIN_DENIED" };
  if (["GET", "HEAD", "OPTIONS"].includes(input.method.toUpperCase())) return { allowed: true };
  if (input.csrfToken === null) return { allowed: false, code: "CSRF_REQUIRED" };
  const actual = await sha256(input.csrfToken);
  return timingSafeEqual(actual, input.session.csrfTokenDigest)
    ? { allowed: true }
    : { allowed: false, code: "CSRF_DENIED" };
}

export function secretRefForDisplay(value: unknown): { configured: boolean; reference?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { configured: false };
  const uri = (value as Record<string, unknown>).uri;
  return typeof uri === "string" && uri.startsWith("secretref://")
    ? { configured: true, reference: uri }
    : { configured: false };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
