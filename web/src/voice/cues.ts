// Short, human thinking cues for the standard voice (the real-time voice gets the same from Nova Sonic): said
// only when VAIC goes into thinking, that is when its answer has not started after a moment. Quick answers get
// none. Varied, never the same one twice in a row.

/** How long VAIC may take before a cue is said, and how often one follows while it keeps working. */
export const CUE_AFTER_MS = 1300;
export const CUE_AGAIN_MS = 9000;
export const MAX_CUES = 2;
/** Mic loudness above which the owner counts as talking: a cue waits for them. */
export const OWNER_TALKING_LEVEL = 0.12;

const FIRST = [
  "Hmm, let me think about that.",
  "Let's see.",
  "Give me a second.",
  "Let me look into that.",
  "Let me check something.",
  "Interesting… one moment.",
  "Give me a second, I'm checking.",
];
const LATER = [
  "Still on it.",
  "Almost there.",
  "Bear with me, this one takes a moment.",
  "Nearly done.",
  "Still working through it.",
];

let previous = "";

/** The next cue: a first one when VAIC starts thinking, later ones while it keeps going. */
export function nextCue(n: number, random: () => number = Math.random): string {
  const list = (n === 0 ? FIRST : LATER).filter((c) => c !== previous);
  previous = list[Math.floor(random() * list.length)] ?? list[0]!;
  return previous;
}
