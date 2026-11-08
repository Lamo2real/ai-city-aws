// Short, human thinking cues for the standard voice (the real-time voice gets the same from Nova Sonic): said
// only when AIC goes into thinking, that is when its answer has not started after a moment. Quick answers get
// none. Varied, never the same one twice in a row.

/** How long AIC may take before a cue is said, and how often one follows while it keeps working. */
export const CUE_AFTER_MS = 1300;
export const CUE_AGAIN_MS = 9000;
export const MAX_CUES = 3;

const FIRST = [
  "Hmm, let me think.",
  "One sec.",
  "Okay, let me check.",
  "Good question. Give me a moment.",
  "Let me look into that.",
  "Mm, one moment.",
  "Right, let me see.",
  "Sure, let me pull that up.",
];
const LATER = [
  "Still on it.",
  "Almost there.",
  "Bear with me, this one takes a moment.",
  "Just pulling that together.",
  "Nearly done.",
  "Still working on it.",
];

let previous = "";

/** The next cue: a first one when AIC starts thinking, later ones while it keeps going. */
export function nextCue(n: number, random: () => number = Math.random): string {
  const list = (n === 0 ? FIRST : LATER).filter((c) => c !== previous);
  previous = list[Math.floor(random() * list.length)] ?? list[0]!;
  return previous;
}
