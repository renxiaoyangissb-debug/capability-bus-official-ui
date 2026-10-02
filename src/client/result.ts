import type { ErrorEnvelope, JsonObject } from "../contracts/types.js";

export type ClientResult =
  | { state: "ready"; data: JsonObject; traceId: string; providerId: string }
  | { state: "offline"; message: string; traceId: string }
  | { state: "incompatible"; message: string; traceId: string }
  | { state: "forbidden"; error: ErrorEnvelope; traceId: string }
  | { state: "error"; error: ErrorEnvelope; traceId: string };
