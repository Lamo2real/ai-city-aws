// The one return address for every sign-in (connectors and mail accounts, MAIL_CALENDAR.md §7):
// AgentCore Identity sends the owner back to /?connect=return. Before opening the provider's page, the card
// stored {kind, id, state, completePath} here; at boot we finish that sign-in and tidy the address bar.
import { api } from "./api.ts";

export const CONNECT_KEY = "vaic.connect";
export interface PendingConnect {
  kind: "mail" | "connector";
  id: string;
  state: string;
  completePath: string;
}

export function rememberConnect(p: PendingConnect) {
  try {
    sessionStorage.setItem(CONNECT_KEY, JSON.stringify(p));
  } catch {
    /* no storage: the return step will say to try again */
  }
}

/** Finishes a sign-in after the provider's page sent the owner back. Null when this isn't a return. */
export async function connectReturn(
  loc: { search: string; pathname: string; hash: string } = location,
  replace: (url: string) => void = (u) => history.replaceState(null, "", u),
): Promise<{ ok: boolean; message: string } | null> {
  const q = new URLSearchParams(loc.search);
  if (q.get("connect") !== "return") return null;
  let pending: PendingConnect | null;
  try {
    pending = JSON.parse(sessionStorage.getItem(CONNECT_KEY) ?? "null") as PendingConnect | null;
  } catch {
    pending = null;
  }
  try {
    sessionStorage.removeItem(CONNECT_KEY);
  } catch {
    /* fine */
  }
  replace(loc.pathname + (loc.hash || "#/vaic")); // the query string (session id, state) leaves the address bar
  if (!pending)
    return { ok: false, message: "That sign-in was started in another tab or has expired. Tap Sign in again." };
  const session = q.get("session_uri") ?? q.get("sessionUri") ?? q.get("session_id") ?? undefined;
  const state = q.get("state") ?? pending.state;
  if (state !== pending.state)
    return { ok: false, message: "That sign-in doesn't belong to this tab. Tap Sign in again." };
  try {
    await api(pending.completePath, { method: "POST", body: { state, ...(session ? { session_uri: session } : {}) } });
    return { ok: true, message: "Signed in. It's connected." };
  } catch (e) {
    return { ok: false, message: `The sign-in didn't finish: ${(e as Error).message}` };
  }
}
