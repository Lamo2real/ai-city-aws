// Which words the microphone heard are really the owner's (the owner, 2026-11-09: "it's just adding stuff on my
// side… I was completely quiet", "it's listening to the music and the noise"). Pure, so the rules are tested.
//
// 1. AIC's own voice: the phone's speaker plays AIC's reply into its microphone, and Transcribe hands the pieces
//    back a moment later ("OK", "something"). A phrase that STARTED while AIC was audibly speaking counts as the
//    owner's only when it says something AIC did not: at least two words that aren't in AIC's reply.
// 2. The room: music, a TV, people nearby. Transcribe is unsure of such words (low confidence) and they are not
//    much louder than the room's steady background; the owner, close to the microphone, is.

/** When AIC's voice was audible (ms since epoch). `end` is open (Infinity) while it is still speaking. */
export interface Span {
  start: number;
  end: number;
}

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Echo arrives a little after the sound left the speaker. */
const TAIL_MS = 600;

/** Whether a phrase that started at `startedAt` overlapped AIC's audible speech. */
export function duringAic(startedAt: number, spans: Span[]): boolean {
  return spans.some((s) => startedAt >= s.start - 200 && startedAt <= s.end + TAIL_MS);
}

/** Words the owner said that AIC's reply doesn't contain. */
export function newWords(heard: string, reply: string): number {
  const r = new Set(words(reply));
  return words(heard).filter((w) => !r.has(w)).length;
}

/** The owner's words, or AIC's own voice coming back? `startedAt` is when the phrase began (from Transcribe's
 *  timings); without it, only the words decide. */
export function isOwnerSpeech(heard: string, reply: string, startedAt: number | null, spans: Span[]): boolean {
  if (!words(heard).length) return false;
  const overlapped = startedAt === null ? spans.some((s) => s.end === Infinity) : duringAic(startedAt, spans);
  if (!overlapped) return true;
  return newWords(heard, reply) >= 2;
}

/** Transcribe's average confidence for the words of a result; null when it gave none. */
export function confidence(items: Array<{ Type?: string; Confidence?: number }> | undefined): number | null {
  const scored = (items ?? []).filter((i) => i.Type === "pronunciation" && typeof i.Confidence === "number");
  if (!scored.length) return null;
  return scored.reduce((a, i) => a + (i.Confidence as number), 0) / scored.length;
}

/** Words Transcribe is this unsure of are dropped as background (music lyrics, a TV, far-away talk). */
export const MIN_CONFIDENCE = 0.55;

/** Whether, in the last `windowMs`, the microphone heard something clearly louder than the room's steady
 *  background (its 20th percentile over the last seconds): the owner close to the mic, not the music. */
export function standsOut(levels: Array<{ t: number; v: number }>, now: number, windowMs = 3000): boolean {
  if (levels.length < 10) return true; // too early to know the room: don't drop the owner's first words
  const sorted = levels.map((l) => l.v).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const recent = levels.filter((l) => now - l.t <= windowMs).map((l) => l.v);
  const peak = recent.length ? Math.max(...recent) : 0;
  return peak >= Math.max(0.015, floor * 2.5);
}
