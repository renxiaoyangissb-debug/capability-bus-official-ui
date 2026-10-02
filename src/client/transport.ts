import type { RequestEnvelope, ResultEnvelope } from "../contracts/types.js";

export interface CoreTransport {
  invoke(request: RequestEnvelope): Promise<ResultEnvelope | unknown>;
}

export class CoreOfflineError extends Error {
  constructor(message = "Core is unavailable") {
    super(message);
    this.name = "CoreOfflineError";
  }
}
