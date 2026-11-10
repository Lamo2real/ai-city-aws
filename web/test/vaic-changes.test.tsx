// VAIC's staged changes in the main chat (decision 206): a `vaic.question` with an id shows what will change and
// Yes / No (a skill's card and Add); a tap is sent as the owner's message; `vaic.change` settles the card; typed words
// instead of a tap leave a change waiting but close a plain question.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(async () => ({ accepted: true })),
  ApiError: class extends Error {},
}));
import { api } from "../src/lib/api.ts";
import { sendMessage } from "../src/lib/actions.ts";
import { store } from "../src/lib/store.ts";
import { ChatCards } from "../src/components/ConnectCard.tsx";

afterEach(() => {
  cleanup();
  vi.mocked(api).mockClear();
  store.set({ cards: [], chat: [] });
});

const change = {
  type: "vaic.question",
  conversation: "main",
  question: "Do you want to save these changes?",
  options: ["Yes", "No"],
  id: "chg-1",
  title: "Settings → Limits & spending",
  lines: ["Workers per goal (one manager's team): 64 → 65", "New workers per second: 1 → 3"],
  detail: "",
};
const asks = () => store.get().cards.filter((c) => c.kind === "ask");
const posted = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([p]) => p === "/messages")
    .map(([, o]) => (o as { body: { text: string } }).body.text);

describe("a staged change in the main chat", () => {
  it("shows what will change with Yes and No, and a tap on Yes is the owner's message", async () => {
    store.event(change);
    render(<ChatCards cards={store.get().cards} />);
    const card = screen.getByRole("group", { name: "Settings → Limits & spending" });
    expect(card.textContent).toContain("64 → 65");
    expect(card.textContent).toContain("Do you want to save these changes?");
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await vi.waitFor(() => expect(posted()).toEqual(["Yes"]));
    expect(asks()[0]).toMatchObject({ answered: "Yes" });
    store.event({ type: "vaic.change", conversation: "main", id: "chg-1", saved: true });
    cleanup();
    render(<ChatCards cards={store.get().cards} />);
    expect(screen.getByRole("status").textContent).toBe("Saved.");
    expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();
  });

  it("No discards: the card says nothing changed", async () => {
    store.event(change);
    await sendMessage("No", { answer: "No" });
    store.event({ type: "vaic.change", conversation: "main", id: "chg-1", saved: false });
    expect(asks()[0]).toMatchObject({ result: "discarded" });
  });

  it("a refused save says it was not saved", async () => {
    store.event(change);
    await sendMessage("Yes", { answer: "Yes" });
    store.event({ type: "vaic.change", conversation: "main", id: "chg-1", saved: false });
    expect(asks()[0]).toMatchObject({ result: "failed" });
  });

  it("typing something else keeps the change waiting with its buttons", async () => {
    store.event(change);
    await sendMessage("what is it now?");
    expect(asks()).toHaveLength(1);
    expect(asks()[0]).not.toHaveProperty("answered");
  });

  it("a newer question replaces an open one; a settled card stays as history", () => {
    store.event(change);
    store.event({ type: "vaic.change", conversation: "main", id: "chg-1", saved: true });
    store.event({ ...change, id: "chg-2" });
    store.event({ ...change, id: "chg-3" });
    expect(asks().map((c) => c.id)).toEqual(["ask:chg-1", "ask:chg-3"]);
  });

  it("a skill shows its card with Add", () => {
    store.event({
      type: "vaic.question",
      conversation: "main",
      question: "Add this skill?",
      options: ["Add", "Not now"],
      id: "chg-9",
      title: "Add the skill Release notes",
      lines: ["Turns merged changes into release notes."],
      detail: "AI City catalog (Product, Application) For every role.",
    });
    render(<ChatCards cards={store.get().cards} />);
    const card = screen.getByRole("group", { name: "Add the skill Release notes" });
    expect(card.textContent).toContain("Turns merged changes");
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
  });
});

describe("a plain question (several skills fit)", () => {
  it("shows the choices; a tap sends it and closes the card", async () => {
    store.event({
      type: "vaic.question",
      conversation: "main",
      question: "Which skill do you mean?",
      options: ["Release notes", "Press release"],
      id: "",
    });
    render(<ChatCards cards={store.get().cards} />);
    fireEvent.click(screen.getByRole("button", { name: "Press release" }));
    await vi.waitFor(() => expect(posted()).toEqual(["Press release"]));
    expect(asks()).toEqual([]);
  });

  it("typed words instead of a tap close it too", async () => {
    store.event({ type: "vaic.question", conversation: "main", question: "Which?", options: ["A", "B"] });
    await sendMessage("neither, the finance one");
    expect(asks()).toEqual([]);
  });

  it("a project's question stays in its project", () => {
    store.event({ type: "vaic.question", conversation: "app-1", question: "Which?", options: ["A", "B"] });
    expect(asks()).toEqual([]);
  });
});
