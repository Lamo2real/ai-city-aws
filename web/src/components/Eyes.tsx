// Ace's eyes: an animated presence (idea from the Mac HUD's eyes). Each state has a shape, a motion
// and a word, so it never relies on colour alone.
import type { Presence } from "../lib/store.ts";

const WORDS: Record<Presence, string> = {
  idle: "Ace is here",
  listening: "Ace is listening",
  thinking: "Ace is thinking",
  speaking: "Ace is speaking",
  waiting: "Ace is waiting for you",
};

export function Eyes({ presence, small = false }: { presence: Presence; small?: boolean }) {
  return (
    <div className={`eyes eyes-${presence} ${small ? "eyes-small" : ""}`} role="img" aria-label={WORDS[presence]}>
      <svg viewBox="0 0 240 90" aria-hidden="true">
        <g className="eye left">
          <ellipse cx="70" cy="45" rx="42" ry="30" className="white" />
          <circle cx="70" cy="45" r="15" className="pupil" />
          <rect x="22" y="10" width="96" height="10" className="lid" />
        </g>
        <g className="eye right">
          <ellipse cx="170" cy="45" rx="42" ry="30" className="white" />
          <circle cx="170" cy="45" r="15" className="pupil" />
          <rect x="122" y="10" width="96" height="10" className="lid" />
        </g>
        {presence === "waiting" ? (
          <text x="120" y="88" textAnchor="middle" className="bang">
            !
          </text>
        ) : null}
      </svg>
      {!small ? <p className="eyes-word">{WORDS[presence]}</p> : null}
    </div>
  );
}
