// What the owner can do, with instant feedback and an outbox: a message that can't be sent stays in
// the chat marked "not sent yet" and goes out when the connection is back. Nothing is lost.
import { api, ApiError } from "./api.ts";
import { listConnectors, listMailAccounts, looksLikeKey } from "./connect.ts";
import { store, type ChatLine } from "./store.ts";
import { errorText, toast } from "../components/ui.tsx";

const CONVERSATION = "main";
const newLineId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function patchLine(id: string, patch: Partial<ChatLine>) {
  store.set({ chat: store.get().chat.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

async function deliver(line: ChatLine) {
  try {
    await api("/messages", {
      method: "POST",
      body: { text: line.text, conversation: CONVERSATION, client_id: line.id, ...(line.voice ? { voice: true } : {}) },
    });
    patchLine(line.id, { state: "sent" });
    // Only if VAIC has not answered yet: its reply can arrive before this request returns (it is always warm),
    // and "thinking" must not come back after it.
    const last = store.get().chat.at(-1);
    if (last?.id === line.id && !last.stopped) store.set({ presence: "thinking" });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) return patchLine(line.id, { state: "failed" }); // kept in the outbox
    // Refused: say why in full, and never send it again (it would be refused again, and hold up the lines after it).
    patchLine(line.id, { state: "failed", refused: true });
    toast({ tone: "bad", text: errorText(e, "VAIC did not accept that message.") });
  }
}

/** Stop (decision 183): drops VAIC's answer to the message it is working on, like Stop in ChatGPT or Claude. The
 * chat shows it at once; VAIC's runtime then cancels the turn (no more words, no further tool calls). Work VAIC
 * already handed to the team keeps going: the job's own Stop ends that. */
export function stopReply(): boolean {
  const line = store.busyLine();
  if (!line) return false;
  store.stopTurn(line.id);
  api(`/messages/${line.id}/stop`, { method: "POST", body: {} }).catch(() =>
    toast({
      tone: "info",
      text: "Stopped here, but VAIC could not be reached to stop its work. Its answer will not show.",
    }),
  );
  return true;
}

/** Keys never go through the chat (CONNECTORS_SKILLS.md §1.3.7): true, with the reason shown, when the text looks
 * like one, so nothing is sent or stored (and the message box keeps what was typed). */
export function keyBlocked(text: string): boolean {
  if (!looksLikeKey(text.trim())) return false;
  toast({
    text: "That looks like a key or password, so it wasn't sent. Use the safe field in the card or in Settings, Connectors. If it was a real key, revoke it.",
    tone: "bad",
  });
  return true;
}

/** Sends a message to VAIC. `voice`: the owner said it (VAIC then answers aloud when speaking is "auto"). */
export async function sendMessage(text: string, opts: { voice?: boolean } = {}) {
  const clean = text.trim();
  if (!clean || keyBlocked(clean)) return;
  const line: ChatLine = {
    id: newLineId(),
    who: "owner",
    text: clean,
    state: "queued",
    at: Date.now(),
    ...(opts.voice ? { voice: true } : {}),
  };
  store.set({ chat: [...store.get().chat, line], presence: "thinking" });
  store.beginTurn();
  await deliver(line);
}

// A service the owner was offered is connected: VAIC picks their request up again (decision 130).
store.onResume = (text) => void sendMessage(text);

/** Coming back to AI City (after signing up or signing in on a service's own page): look again at whatever a card
 * or a waiting request follows, so it turns connected without a reload (decision 141). Events do the same when the
 * live connection is up; this covers a sleeping tab or a dropped socket. */
export async function refreshFollowed() {
  const { connectors, mail } = store.following();
  const [c, m] = await Promise.all([
    connectors.length ? listConnectors().catch(() => null) : null,
    mail.length ? listMailAccounts().catch(() => null) : null,
  ]);
  for (const x of c?.connectors ?? [])
    if (connectors.includes(x.id))
      store.event({
        type: "connector.updated",
        id: x.id,
        label: x.label ?? x.id,
        status: x.status,
        needs: x.needs,
        error: x.error,
      });
  for (const a of m?.accounts ?? []) if (mail.includes(a.id)) store.event({ type: "mail.account", account: a });
}
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => void refreshFollowed());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshFollowed();
  });
}

/** Re-sends everything the outbox holds. The server ignores a line it already has (same client id). */
export async function flushOutbox() {
  const waiting = (x: ChatLine) =>
    x.who === "owner" && !x.refused && !x.stopped && (x.state === "queued" || x.state === "failed");
  for (const l of store.get().chat.filter(waiting)) await deliver(l);
}

export async function loadCity() {
  store.beginSnapshot();
  try {
    store.snapshot(await api("/city"));
  } catch (e) {
    store.set({ loadError: (e as Error).message });
  }
}

export const answerQuestion = (id: string, answer: string) =>
  api(`/questions/${id}/answer`, { method: "POST", body: { answer } });
export const applyDefault = (id: string) => api(`/questions/${id}/default`, { method: "POST", body: {} });
export const decideApproval = (id: string, approved: boolean) =>
  api(`/approvals/${id}`, { method: "POST", body: { approved } });
/** Every worker drops what it is doing and walks home; the city keeps running. Instant: no model in the loop. */
/** Stops one job: its open parts are cancelled and its workers go home. */
export const cancelJob = (id: string) =>
  api<{ jobs: number; workers: number }>(`/tasks/${id}/cancel`, { method: "POST" });
export const instruct = (agentId: string, text: string) =>
  api("/city/instruct", { method: "POST", body: { agent_id: agentId, text } });
/** The owner clicked a worker and chose "Send home": that one worker walks home; its job and manager stay. */
export const sendWorkerHome = (workerId: string) =>
  api<{ workers: number; parts: number; failed: number }>(`/agents/${encodeURIComponent(workerId)}/home`, {
    method: "POST",
  });
export const saveSettings = (patch: Record<string, unknown>) =>
  api<{ settings: Record<string, unknown> }>("/settings", { method: "PUT", body: patch });
