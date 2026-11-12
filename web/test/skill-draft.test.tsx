// A skill VAIC wrote (decision 257): the `vaic.question` carries the SKILL.md, the chat card shows an excerpt and
// "View skill", and the panel renders the Markdown with Add / Not now; a newer draft replaces the shown one.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api.ts", () => ({
  api: vi.fn(async () => ({ accepted: true })),
  ApiError: class extends Error {},
}));
import { api } from "../src/lib/api.ts";
import { store } from "../src/lib/store.ts";
import { ChatCards } from "../src/components/ConnectCard.tsx";
import { SkillPanel, skillBody, useShownDraft } from "../src/components/SkillDraft.tsx";

afterEach(() => {
  cleanup();
  vi.mocked(api).mockClear();
  store.set({ cards: [], chat: [] });
});

const md = (body: string) =>
  `---\nname: "code-animation"\ndescription: "Silent code-made videos."\n---\n# Code animation\n\n${body}\n`;
const draft = (id: string, body: string) => ({
  type: "vaic.question",
  conversation: "main",
  question: "Add this skill?",
  options: ["Add", "Not now"],
  id,
  title: "Add the skill code-animation",
  lines: ["Silent code-made videos."],
  detail: "For every role.",
  skill: {
    name: "code-animation",
    description: "Silent code-made videos.",
    markdown: md(body),
    files: [],
    replacing: false,
  },
});
const posted = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([p]) => p === "/messages")
    .map(([, o]) => (o as { body: { text: string } }).body.text);

function Shown() {
  const d = useShownDraft();
  return d ? <SkillPanel d={d} sheet /> : null;
}

describe("a skill VAIC drafted", () => {
  it("keeps the whole SKILL.md and renders its body without the frontmatter", () => {
    store.event(draft("chg-1", "- **Storyboard** with Video production\n- 1 to 2 second scenes"));
    const c = store.get().cards[0];
    expect(c?.kind === "ask" && c.skill?.name).toBe("code-animation");
    expect(skillBody(md("x"))).toBe("# Code animation\n\nx");
  });

  it("on a phone the card shows an excerpt and View skill opens the sheet with Add", async () => {
    store.event(draft("chg-1", "Every scene runs 1 to 2 seconds."));
    render(
      <>
        <ChatCards cards={store.get().cards} />
        <Shown />
      </>,
    );
    const card = screen.getByRole("group", { name: "Add the skill code-animation" });
    expect(card.textContent).toContain("Code animation · Every scene runs 1 to 2 seconds.");
    expect(screen.queryByRole("dialog")).toBeNull(); // narrow: nothing opens by itself
    fireEvent.click(screen.getByRole("button", { name: "View skill" }));
    const sheet = await screen.findByRole("dialog", { name: "code-animation" });
    expect(sheet.querySelector("h3")?.textContent).toBe("Code animation");
    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));
    expect(sheet.querySelector(".skill-raw")?.textContent).toContain('name: "code-animation"');
    fireEvent.click(sheet.querySelector<HTMLButtonElement>(".choice-yes")!);
    await vi.waitFor(() => expect(posted()).toEqual(["Add"]));
    act(() => store.event({ type: "vaic.change", conversation: "main", id: "chg-1", saved: true }));
    expect(screen.getByRole("dialog").textContent).toContain("Added. It's on the Skills page");
  });

  it("a re-draft replaces the shown one, and × closes it", async () => {
    store.event(draft("chg-3", "First version."));
    render(<Shown />);
    expect(screen.queryByRole("dialog")).toBeNull(); // narrow: opens on View skill
    const { openSkill } = await import("../src/components/SkillDraft.tsx");
    act(() => openSkill(String(store.get().cards[0]?.id)));
    expect(screen.getByRole("dialog").textContent).toContain("First version.");
    act(() => store.event(draft("chg-4", "Second version.")));
    act(() => openSkill(String(store.get().cards.at(-1)?.id)));
    expect(screen.getByRole("dialog").textContent).toContain("Second version.");
    expect(screen.getByRole("dialog").textContent).not.toContain("First version.");
    fireEvent.click(screen.getByRole("button", { name: "Close the skill" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
