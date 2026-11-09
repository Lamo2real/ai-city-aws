// Which words the microphone heard are really the owner's (the owner, 2026-11-09: "it's just adding stuff on my
// side… I was completely quiet", "it's listening to the music and the noise"). Pure, so the rules are tested.
//
// 1. VAIC's own voice: the phone's speaker plays VAIC's reply into its microphone, and Transcribe hands the pieces
//    back a moment later ("OK", "something"). A phrase that STARTED while VAIC was audibly speaking counts as the
//    owner's only when it says something VAIC did not: at least two words that aren't in VAIC's reply.
// 2. The room: music, a TV, people nearby. Transcribe is unsure of such words (low confidence) and they are not
//    much louder than the room's steady background; the owner, close to the microphone, is.

/** When VAIC's voice was audible (ms since epoch). `end` is open (Infinity) while it is still speaking. */
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

/** Whether a phrase that started at `startedAt` overlapped VAIC's audible speech. */
export function duringAic(startedAt: number, spans: Span[]): boolean {
  return spans.some((s) => startedAt >= s.start - 200 && startedAt <= s.end + TAIL_MS);
}

/** Words the owner said that VAIC's reply doesn't contain. */
export function newWords(heard: string, reply: string): number {
  const r = new Set(words(reply));
  return words(heard).filter((w) => !r.has(w)).length;
}

/** Words the owner says to cut VAIC off. One of them, not in what VAIC is saying, is enough to count as the
 *  owner talking over it ("stop", "wait", "no"); anything else needs two words of the owner's own. */
const INTERRUPTS = new Set([
  "stop",
  "wait",
  "hold",
  "hang",
  "pause",
  "no",
  "nope",
  "cancel",
  "enough",
  "quiet",
  "shush",
  "vaic",
  "vice",
]);

export interface Judge {
  /** A live partial (the phrase is still being said): it must be mostly the owner's own words. */
  partial?: boolean;
  /** When the owner was last heard talking over VAIC (it was cut off then). A phrase that starts around then is
   *  the owner's interruption: one word of their own is enough, because VAIC is already quiet. */
  bargedAt?: number | null;
  /** The time now (tests); Date.now() otherwise. */
  now?: number;
}

/** How long before a barge-in the owner's interrupting phrase may have started (the detector waits for speech
 *  to last, and Transcribe's phrase can begin with a breath), and how long after it a phrase still belongs to it. */
const BARGE_LEAD_MS = 2500;
const BARGE_LAG_MS = 1500;
/** Without timings, how long after a barge-in the words heard still count as the interruption. */
const BARGE_UNTIMED_MS = 5000;

/** Whether a phrase is the one the owner cut VAIC off with. */
export function aroundBarge(startedAt: number | null, bargedAt: number | null, now: number): boolean {
  if (bargedAt === null) return false;
  if (startedAt === null) return now - bargedAt <= BARGE_UNTIMED_MS;
  return startedAt >= bargedAt - BARGE_LEAD_MS && startedAt <= bargedAt + BARGE_LAG_MS;
}

/** The owner's words, or VAIC's own voice coming back? `startedAt` is when the phrase began (from Transcribe's
 *  timings); without it, only the words decide. `reply` is what VAIC said (its reply and its last thinking cue). */
export function isOwnerSpeech(
  heard: string,
  reply: string,
  startedAt: number | null,
  spans: Span[],
  judge: Judge = {},
): boolean {
  const all = words(heard);
  if (!all.length) return false;
  const overlapped = startedAt === null ? spans.some((s) => s.end === Infinity) : duringAic(startedAt, spans);
  if (!overlapped) return true;
  const r = new Set(words(reply));
  const own = all.filter((w) => !r.has(w));
  if (own.some((w) => INTERRUPTS.has(w))) return true;
  if (own.length >= 1 && aroundBarge(startedAt, judge.bargedAt ?? null, judge.now ?? Date.now())) return true;
  if (judge.partial) return own.length >= 2 && own.length / all.length >= 0.5;
  return own.length >= 2;
}

/** The owner's interruption without VAIC's echo in front of it: Transcribe often joins the last words VAIC said
 *  ("…the meeting is at") to what the owner said over them. A leading run of three or more words that VAIC said
 *  in that order is cut; anything shorter could be the owner's own. */
export function stripEcho(heard: string, reply: string): string {
  const tokens = heard.trim().split(/\s+/).filter(Boolean);
  const norm = tokens.map((t) => words(t).join(" "));
  const said = words(reply);
  if (!said.length) return heard.trim();
  let best = 0;
  for (let i = 0; i < said.length; i++) {
    let n = 0;
    while (n < norm.length && i + n < said.length && norm[n] === said[i + n]) n++;
    best = Math.max(best, n);
  }
  if (best < 3) return heard.trim();
  return tokens
    .slice(best)
    .join(" ")
    .replace(/^[,.;:!?…-]+\s*/, "");
}

/** Transcribe's average confidence for the words of a result; null when it gave none. */
export function confidence(items: Array<{ Type?: string; Confidence?: number }> | undefined): number | null {
  const scored = (items ?? []).filter((i) => i.Type === "pronunciation" && typeof i.Confidence === "number");
  if (!scored.length) return null;
  return scored.reduce((a, i) => a + (i.Confidence as number), 0) / scored.length;
}

/** Words Transcribe is this unsure of are dropped as background (music lyrics, a TV, far-away talk). */
export const MIN_CONFIDENCE = 0.55;

/** Whether the microphone heard something clearly louder than the room's steady background (its 20th percentile
 *  over the last seconds) between `from` and `to` (ms, the phrase's own time from Transcribe, with a margin): the
 *  owner close to the mic, not the music. Judged on the phrase itself, never on "the last few seconds": Transcribe's
 *  final can arrive seconds after the owner stopped talking, and judging the quiet since then dropped the owner's
 *  words (the owner, 2026-11-09: "I can't even speak to it"). */
export function standsOut(levels: Array<{ t: number; v: number }>, from: number, to: number): boolean {
  if (levels.length < 10) return true; // too early to know the room: don't drop the owner's first words
  const sorted = levels.map((l) => l.v).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const during = levels.filter((l) => l.t >= from - 250 && l.t <= to + 250).map((l) => l.v);
  if (!during.length) return true; // no level for that moment (it has scrolled out): don't drop the owner
  return Math.max(...during) >= Math.max(0.01, floor * 2.5);
}
