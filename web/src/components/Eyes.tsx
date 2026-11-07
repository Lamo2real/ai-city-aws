// AIC's eye: the owner's own eye drawing (public/ace-eye.png, white lines with a transparent background), one
// eye, used as a mask so each state can colour and move it. Each state has a colour, a motion and a word, so
// it never relies on colour alone.
import type { Presence } from "../lib/store.ts";

const WORDS: Record<Presence, string> = {
  idle: "AIC is here",
  listening: "AIC is listening",
  thinking: "AIC is thinking",
  speaking: "AIC is speaking",
  waiting: "AIC is waiting for you",
};

export function Eyes({
  presence,
  small = false,
  word = true,
}: {
  presence: Presence;
  small?: boolean;
  /** Show the state as a visible line under the eye (the AIC screen says it in the voice strip instead). */
  word?: boolean;
}) {
  return (
    <div className={`eyes eyes-${presence} ${small ? "eyes-small" : ""}`} role="img" aria-label={WORDS[presence]}>
      <div className="eye-pair" aria-hidden="true">
        <span className="eye-shape" />
      </div>
      {presence === "waiting" && !small ? (
        <span className="bang" aria-hidden="true">
          !
        </span>
      ) : null}
      {!small && word ? <p className="eyes-word">{WORDS[presence]}</p> : null}
    </div>
  );
}
