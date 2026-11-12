// A chat that stays on its newest line (the owner, 2026-11-11 and 2026-11-12, decision 281): while anything below
// grows (a reply revealed word by word, a builder's step, a card) the view ticks down with it, as long as the owner
// is at the bottom (within 80 px). Scrolled up to read, nothing moves him; a "↓ New messages" button appears
// instead. `jump` changing (the owner sent something) always brings the view down, smoothly.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const NEAR_BOTTOM_PX = 80;

export function useStickToBottom(log: RefObject<HTMLElement | null>, jump: unknown) {
  const stick = useRef(true);
  const jumping = useRef(0); // until this time a smooth scroll is on its way down: it doesn't count as reading
  const [newBelow, setNewBelow] = useState(false);

  const toBottom = useCallback(
    (smooth = true) => {
      const el = log.current;
      if (!el) return;
      stick.current = true;
      setNewBelow(false);
      jumping.current = Date.now() + 900;
      if (typeof el.scrollTo === "function")
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      else el.scrollTop = el.scrollHeight;
    },
    [log],
  );

  const first = useRef(true);
  useEffect(() => {
    toBottom(!first.current); // the first time instantly: the page opens at the newest line
    first.current = false;
  }, [jump, toBottom]);

  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const gap = () => el.scrollHeight - el.scrollTop - el.clientHeight;
    const onScroll = () => {
      const near = gap() <= NEAR_BOTTOM_PX;
      if (near) {
        jumping.current = 0;
        stick.current = true;
        setNewBelow(false);
      } else if (Date.now() > jumping.current) stick.current = false;
    };
    const grew = () => {
      if (stick.current) {
        // On the way down already: follow the end as it moves; at the bottom: tick down with every new row.
        if (Date.now() < jumping.current && typeof el.scrollTo === "function")
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        else el.scrollTop = el.scrollHeight;
      } else if (gap() > NEAR_BOTTOM_PX) setNewBelow(true);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(grew) : null;
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(grew) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      mo?.disconnect();
      ro?.disconnect();
    };
  }, [log]);

  /** For content that grows without a DOM change the observers see (a canvas, a reveal driven by styles). */
  const follow = useCallback(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  return { newBelow, toBottom, follow };
}

/** The button that shows while there is news below the part the owner is reading. */
export function NewBelow({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="new-below" onClick={onClick}>
      <span aria-hidden="true">↓</span> New messages
    </button>
  );
}
