// Quick replies under AIC's latest reply: big buttons that answer in one tap, so the owner never has to type
// the obvious next thing. Each one sends its words to AIC as an ordinary (typed) message, except "Show me",
// which opens the finished work.
//   AIC asked a question          → "Yes", "No"
//   work AIC handed on is running → "How's it going?", "Stop it"
//   a result came back since the owner last wrote → "Show me", "Thanks"
import { stepsRunning } from "./steps.ts";
import type { ChatLine } from "./store.ts";

export interface Chip {
  label: string;
  /** Words sent to AIC; absent for a chip that opens a screen. */
  send?: string;
  /** A screen to open instead. */
  go?: string;
}

/** Ends with a question mark, ignoring trailing Markdown, quotes, brackets and emoji. */
export function endsWithQuestion(text: string): boolean {
  const t = text.replace(/[\s*_`"'”’)\]\p{Extended_Pictographic}\u{FE0F}]+$/u, "");
  return t.endsWith("?");
}

/** The chips for the chat as it is now. `lastResultAt`: when the latest result came back (or null). */
export function chipsFor(chat: ChatLine[], lastResultAt: number | null): Chip[] {
  const last = chat.at(-1);
  if (!last || last.who !== "ace" || last.state !== "done") return []; // only under AIC's finished reply
  const chips: Chip[] = [];
  if (endsWithQuestion(last.text)) chips.push({ label: "Yes", send: "Yes" }, { label: "No", send: "No" });
  const running = chat.some((l) => l.who === "ace" && stepsRunning(l));
  if (running) chips.push({ label: "How's it going?", send: "How's it going?" }, { label: "Stop it", send: "Stop it" });
  const lastOwner = chat.findLast((l) => l.who === "owner");
  if (!running && lastResultAt !== null && lastResultAt > (lastOwner?.at ?? 0))
    chips.push({ label: "Show me", go: "tickets" }, { label: "Thanks", send: "Thanks!" });
  return chips;
}
