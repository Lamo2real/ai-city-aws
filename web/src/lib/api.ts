// The HTTP API with the owner's token. Errors become plain sentences with a hint, never codes.
import { idToken } from "./auth.ts";
import { config } from "./config.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fix: string | null = null,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await idToken();
  if (!token) throw new ApiError("You were signed out.", 401, "Sign in again.");
  let r: Response;
  try {
    r = await fetch(`${config().apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("No connection to AI City right now.", 0, "Check your connection; we'll keep trying.");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; fix?: string | null };
  if (!r.ok) throw new ApiError(j.error ?? "Something went wrong.", r.status, j.fix ?? null);
  return j as T;
}
