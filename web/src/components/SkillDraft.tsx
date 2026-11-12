// A skill VAIC wrote, read before Add (decision 257). On a wide screen it opens beside the chat, which narrows to
// the left, like an artifact panel; on a phone the chat card shows an excerpt and "View skill" opens a full-screen
// sheet. Add / Not now are sent as the owner's answer, exactly like the card's buttons, so typing or saying it works
// the same. A newer draft from VAIC replaces the shown one; saving closes the panel with a confirmation.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { sendMessage } from "../lib/actions.ts";
import { readFrontmatter } from "../lib/connect.ts";
import { Markdown } from "../lib/markdown.tsx";
import { useHud, type ConnectCardState } from "../lib/store.ts";

type Ask = Extract<ConnectCardState, { kind: "ask" }>;
export const WIDE = "(min-width: 900px)";

// Which draft the owner opened (phone) or closed (wide screen); a module store so the card and the panel agree.
let view: { opened: string | null; closed: ReadonlySet<string> } = { opened: null, closed: new Set() };
const listeners = new Set<() => void>();
function setView(v: Partial<typeof view>) {
  view = { ...view, ...v };
  listeners.forEach((l) => l());
}
const subscribeView = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
function useView() {
  return useSyncExternalStore(subscribeView, () => view);
}
export function openSkill(id: string) {
  const closed = new Set(view.closed);
  closed.delete(id);
  setView({ opened: id, closed });
}
function closeSkill(id: string) {
  setView({ opened: null, closed: new Set(view.closed).add(id) });
}

const wideQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE) : null);
function subscribeWide(l: () => void) {
  const q = wideQuery();
  q?.addEventListener("change", l);
  return () => q?.removeEventListener("change", l);
}
export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => wideQuery()?.matches ?? false);
}

/** The newest skill draft in the chat that is still open, or just saved (for the confirmation). */
function latestDraft(cards: ConnectCardState[]): Ask | null {
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (c?.kind === "ask" && c.skill) return c.result === undefined || c.result === "saved" ? c : null;
  }
  return null;
}

/** The draft shown now: beside the chat on a wide screen (unless closed), on a phone only once opened. */
export function useShownDraft(): Ask | null {
  const cards = useHud((s) => s.cards);
  const v = useView();
  const wide = useWide();
  const [gone, setGone] = useState<string | null>(null);
  const d = latestDraft(cards);
  const saved = d?.result === "saved";
  useEffect(() => {
    if (!saved || !d) return;
    const t = window.setTimeout(() => setGone(d.id), 2600);
    return () => window.clearTimeout(t);
  }, [saved, d]);
  if (!d || v.closed.has(d.id) || gone === d.id) return null;
  if (saved && v.opened !== d.id && !wide) return null;
  return wide || v.opened === d.id ? d : null;
}

/** The SKILL.md without its frontmatter: what the panel renders. */
export function skillBody(markdown: string): string {
  return readFrontmatter(markdown).body.trim();
}

export function SkillPanel({ d, sheet }: { d: Ask; sheet: boolean }) {
  const s = d.skill;
  const [raw, setRaw] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!sheet) return;
    ref.current?.querySelector<HTMLElement>(".skill-x")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeSkill(d.id);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [sheet, d.id]);
  useEffect(() => {
    ref.current?.querySelector(".skill-doc")?.scrollTo?.(0, 0);
  }, [s?.markdown]);
  if (!s) return null;
  const body = (
    <aside
      ref={ref}
      className={`skill-side panel${sheet ? " is-sheet" : ""}`}
      role={sheet ? "dialog" : "complementary"}
      aria-modal={sheet || undefined}
      aria-labelledby="skill-draft-title"
    >
      <header className="skill-side-head">
        <div>
          <p className="eyebrow">{s.replacing ? "New version of a skill" : "New skill"} · SKILL.md</p>
          <h2 id="skill-draft-title">{s.name}</h2>
        </div>
        <button
          type="button"
          className="icon-btn skill-x"
          aria-label="Close the skill"
          title="Close"
          onClick={() => closeSkill(d.id)}
        >
          ×
        </button>
      </header>
      <div className="skill-tabs" role="tablist" aria-label="How to show the skill">
        <button type="button" role="tab" aria-selected={!raw} className="skill-tab" onClick={() => setRaw(false)}>
          Preview
        </button>
        <button type="button" role="tab" aria-selected={raw} className="skill-tab" onClick={() => setRaw(true)}>
          Markdown
        </button>
      </div>
      <div className="skill-doc" tabIndex={0} aria-label={raw ? "SKILL.md as Markdown" : "The skill"}>
        {raw ? (
          <pre className="skill-raw">{s.markdown}</pre>
        ) : (
          <>
            <p className="skill-desc">{s.description}</p>
            <div className="skill-md">
              <Markdown text={skillBody(s.markdown)} />
            </div>
          </>
        )}
        {s.files.length ? <p className="mute">Also in the skill: {s.files.join(", ")}</p> : null}
        {d.detail ? <p className="mute">{d.detail}</p> : null}
      </div>
      <footer className="skill-side-foot">
        {d.result === "saved" ? (
          <p className="ask-done" role="status">
            {s.replacing ? "Saved." : "Added."} It's on the Skills page; agents use it from their next turn.
          </p>
        ) : d.answered ? (
          <p className="mute" role="status">{`${d.answered}: saving…`}</p>
        ) : (
          <>
            <p className="skill-q">{d.question}</p>
            <div className="choices">
              {d.options.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  className={`choice choice-big${i === 0 ? " choice-yes" : ""}`}
                  onClick={() => void sendMessage(o, { answer: o })}
                >
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
      </footer>
    </aside>
  );
  // The sheet covers the whole screen, top bar included: it lives on the page itself, out of the chat's layers.
  return sheet
    ? createPortal(
        <div className="scrim skill-scrim" role="presentation">
          {body}
        </div>,
        document.body,
      )
    : body;
}

/** The excerpt and "View skill" on the chat card (decision 257). */
export function SkillExcerpt({ d }: { d: Ask }) {
  const s = d.skill;
  if (!s) return null;
  const first = skillBody(s.markdown)
    .split("\n")
    .map((l) => l.replace(/^(#+|[-*+]|\d+[.)])\s+/, "").replace(/[*_`]+/g, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
  return (
    <div className="skill-excerpt">
      <p className="mute">{first.length > 180 ? `${first.slice(0, 179)}…` : first}</p>
      <button type="button" className="choice" onClick={() => openSkill(d.id)}>
        View skill
      </button>
    </div>
  );
}
