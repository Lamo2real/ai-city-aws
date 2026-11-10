// VAIC's reply as it streams: the text arriving from the server (in ~80 ms batches) is revealed at a steady
// pace, like typing, catching up when it falls behind. Half-arrived Markdown is held back so nothing flickers
// (an unclosed **bold** or `code`, a table row still arriving, a table header before its rule line). When the
// reply is done it snaps to the final text. With prefers-reduced-motion the text appears directly.
import { useEffect, useRef, useState } from "react";
import { Markdown } from "../lib/markdown.tsx";

const BASE_CPS = 120; // characters per second at the calm pace
const CATCH_UP_S = 0.35; // a backlog shrinks by about two thirds in this long

/** How many characters to show after dtMs, given how many are shown and how many have arrived. */
export function nextShown(shown: number, arrived: number, dtMs: number): number {
  if (shown >= arrived) return arrived;
  const backlog = arrived - shown;
  const cps = Math.max(BASE_CPS, backlog / CATCH_UP_S);
  return Math.min(arrived, shown + Math.max(1, Math.round((cps * dtMs) / 1000)));
}

const isRule = (l: string | undefined) => !!l && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

/** The first n characters of a streaming Markdown text, trimmed so that half-arrived markup is not shown. */
export function revealable(full: string, n: number): string {
  let s = full.slice(0, n);
  const lines = s.split("\n");
  const fullLines = full.split("\n");
  // A table line still arriving waits until it is whole.
  const lastIdx = lines.length - 1;
  if ((lines[lastIdx] ?? "").trimStart().startsWith("|") && n < full.length) lines.pop();
  // A table header waits for its rule line, so it never shows first as a plain line.
  const i = lines.length - 1;
  const last = lines[i] ?? "";
  if (last.includes("|") && !isRule(last) && !(i > 0 && (lines[i - 1] ?? "").includes("|")) && isRule(fullLines[i + 1]))
    lines.pop();
  // A trailing rule line without its header (cannot happen once the header waits) and a lone fence are fine.
  s = lines.join("\n");
  // An unclosed ** or ` is held back from its opening marker on.
  for (const mark of ["**", "`"]) {
    const count = s.split(mark).length - 1;
    if (count % 2 === 1) s = s.slice(0, s.lastIndexOf(mark));
  }
  return s;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function StreamedText(p: { text: string; streaming: boolean; onGrow?: () => void }) {
  const [shown, setShown] = useState(() => (p.streaming && !reducedMotion() ? 0 : p.text.length));
  const target = useRef(p.text.length);
  target.current = p.text.length;
  const onGrow = useRef(p.onGrow);
  onGrow.current = p.onGrow;

  useEffect(() => {
    if (!p.streaming || reducedMotion()) {
      setShown(p.text.length); // done (or no motion wanted): the whole text, at once
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      setShown((s) => nextShown(s, target.current, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // The loop reads the growing text through a ref, so it restarts only when streaming starts or ends.
  }, [p.streaming]);

  useEffect(() => onGrow.current?.(), [shown]);

  // With reduced motion nothing counts up, so the text itself is shown as it arrives.
  const visible = p.streaming && !reducedMotion() ? revealable(p.text, shown) : p.text;
  return <Markdown text={visible} />;
}
