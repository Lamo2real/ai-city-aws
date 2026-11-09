// VAIC's eye: the owner's own eye drawing (public/ace-eye.png, white lines with a transparent background), one
// eye, used as a mask so it takes the ink or paper colour of where it sits. It stays still and the same colour
// in every state (the owner's choice); the state is in its accessible name, and on the VAIC screen the voice
// line under it shows the state.
import type { Presence } from "../lib/store.ts";

const WORDS: Record<Presence, string> = {
  idle: "VAIC is here",
  listening: "VAIC is listening",
  thinking: "VAIC is thinking",
  speaking: "VAIC is speaking",
  waiting: "VAIC is waiting for you",
};

export function Eyes({
  presence,
  small = false,
  word = true,
}: {
  presence: Presence;
  small?: boolean;
  /** Show the state as a visible line under the eye (the VAIC screen says it in the voice strip instead). */
  word?: boolean;
}) {
  return (
    <div className={`eyes eyes-${presence} ${small ? "eyes-small" : ""}`} role="img" aria-label={WORDS[presence]}>
      <div className="eye-pair" aria-hidden="true">
        <span className="eye-shape" />
      </div>
      {!small && word ? <p className="eyes-word">{WORDS[presence]}</p> : null}
    </div>
  );
}
