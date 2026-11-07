import { describe, expect, it } from "vitest";
import { chipsFor, endsWithQuestion } from "../src/lib/chips.ts";
import type { ChatLine } from "../src/lib/store.ts";

const owner = (at: number, text = "hi"): ChatLine => ({ id: `o${at}`, who: "owner", text, state: "sent", at });
const aic = (at: number, text: string, extra: Partial<ChatLine> = {}): ChatLine => ({
  id: `a${at}`,
  who: "ace",
  text,
  state: "done",
  at,
  ...extra,
});
const labels = (chat: ChatLine[], lastResultAt: number | null = null) =>
  chipsFor(chat, lastResultAt).map((c) => c.label);

describe("quick replies under AIC's reply", () => {
  it("a question gets Yes and No", () => {
    expect(labels([owner(1), aic(2, "Want me to check on the GT3 sentences?")])).toEqual(["Yes", "No"]);
    expect(labels([owner(1), aic(2, "Want **more**? 🙂")])).toEqual(["Yes", "No"]);
    expect(labels([owner(1), aic(2, "All quiet. Nothing needs you.")])).toEqual([]);
  });
  it("while handed-on work runs: How's it going? and Stop it", () => {
    const running = aic(2, "On it.", { tasks: [{ id: "t", done: false }] });
    expect(labels([owner(1), running])).toEqual(["How's it going?", "Stop it"]);
    expect(labels([owner(1), running, owner(3), aic(4, "Sure. Anything else?")])).toEqual([
      "Yes",
      "No",
      "How's it going?",
      "Stop it",
    ]);
  });
  it("after a result comes back (since the owner last wrote): Show me and Thanks", () => {
    const settled = aic(2, "On it.", { tasks: [{ id: "t", done: true }] });
    const chat = [owner(1), settled, aic(5, "Your budget app is ready.")];
    expect(chipsFor(chat, 4)).toEqual([
      { label: "Show me", go: "tickets" },
      { label: "Thanks", send: "Thanks!" },
    ]);
    expect(labels([...chat, owner(6), aic(7, "You're welcome.")], 4)).toEqual([]); // the owner already answered
  });
  it("nothing while AIC is still writing, or under the owner's own message", () => {
    expect(labels([owner(1), aic(2, "Want me to?", { state: "streaming" })])).toEqual([]);
    expect(labels([aic(1, "Want me to?"), owner(2)])).toEqual([]);
    expect(labels([])).toEqual([]);
  });
  it("question detection ignores trailing Markdown and emoji", () => {
    expect(endsWithQuestion("Shall I go ahead?**")).toBe(true);
    expect(endsWithQuestion("Done. (Was that it?)")).toBe(true);
    expect(endsWithQuestion("Is it? No. It's done.")).toBe(false);
  });
});
