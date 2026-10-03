import { CoreOfflineError } from "../client/transport.js";
import type { ManagementRequest, ManagementTransport } from "./client.js";

export class BrowserManagementTransport implements ManagementTransport {
  private csrfToken: string | null = null;

  async invoke(request: ManagementRequest): Promise<unknown> {
    const csrfToken = this.csrfToken ?? await this.openSession();
    try {
      const response = await fetch("/api/management", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(request)
      });
      const value: unknown = await response.json();
      if (response.status === 401) this.csrfToken = null;
      return value;
    } catch (error) {
      throw new CoreOfflineError(error instanceof Error ? error.message : "UI backend is unavailable");
    }
  }

  private async openSession(): Promise<string> {
    try {
      const response = await fetch("/api/session", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error(`Browser session rejected (${response.status})`);
      const value = await response.json() as { csrf_token?: unknown };
      if (typeof value.csrf_token !== "string" || value.csrf_token.length < 32) throw new Error("Browser session response is invalid");
      this.csrfToken = value.csrf_token;
      return value.csrf_token;
    } catch (error) {
      throw new CoreOfflineError(error instanceof Error ? error.message : "Browser session is unavailable");
    }
  }
}
