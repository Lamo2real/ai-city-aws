// What the owner can do, with instant feedback and an outbox: a message that can't be sent stays in
// the chat marked "not sent yet" and goes out when the connection is back. Nothing is lost.
import { api, ApiError } from "./api.ts";
import { looksLikeKey } from "./connect.ts";
import { store, type ChatLine } from "./store.ts";
import { toast } from "../components/ui.tsx";

const CONVERSATION = "main";
const newLineId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function patchLine(id: string, patch: Partial<ChatLine>) {
  store.set({ chat: store.get().chat.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

async function deliver(line: ChatLine) {
  try {
    await api("/messages", {
      method: "POST",
      body: { text: line.text, conversation: CONVERSATION, client_id: line.id },
    });
    patchLine(line.id, { state: "sent" });
    store.set({ presence: "thinking" });
  } catch (e) {
    patchLine(line.id, { state: "failed" });
    if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) return; // kept in the outbox
    throw e;
  }
}

/** Sends a message to AIC. `voice`: the owner said it (AIC then answers aloud when speaking is "auto"). */
export async function sendMessage(text: string, opts: { voice?: boolean } = {}) {
  const clean = text.trim();
  if (!clean) return;
  if (looksLikeKey(clean)) {
    // Keys never go through the chat (CONNECTORS_SKILLS.md §1.3.7): nothing is sent or stored.
    toast({
      text: "That looks like a key or password, so it wasn't sent. Use the safe field in the card or in Settings, Connectors. If it was a real key, revoke it.",
      tone: "bad",
    });
    return;
  }
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

/** Re-sends everything the outbox holds. The server ignores a line it already has (same client id). */
export async function flushOutbox() {
  for (const l of store.get().chat.filter((x) => x.who === "owner" && (x.state === "queued" || x.state === "failed")))
    await deliver(l);
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
export const setPaused = (paused: boolean) => api(paused ? "/city/pause" : "/city/resume", { method: "POST" });
export const instruct = (agentId: string, text: string) =>
  api("/city/instruct", { method: "POST", body: { agent_id: agentId, text } });
export const saveSettings = (patch: Record<string, unknown>) =>
  api<{ settings: Record<string, unknown> }>("/settings", { method: "PUT", body: patch });
