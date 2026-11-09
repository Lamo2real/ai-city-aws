// What the owner said, without the stumbles (the owner's rule, 2026-11-08): fillers ("um", "uh", "er", "hmm"),
// stammered repeats ("I I think", "the the", "w- well") and filler-only utterances never reach the box, the chat
// or AIC. Words inside quotation marks are the owner's on purpose ("remove the words "um" and "like" from the
// app") and stay exactly as said. Pure, so it is tested on its own and shared by dictation and voice.

/** Sounds that carry no meaning on their own. */
const FILLER = "(?:uh[- ]huh|u+h*m+|u+h+|e+r+m*|a+h+|h+m+|m+h*m+|mhm)";
const BETWEEN_COMMAS = new RegExp(`,\\s*${FILLER}\\s*,\\s*`, "gi");
const FILLER_WORD = new RegExp(`(^|[\\s,.;!?…-])${FILLER}(?=$|[\\s,.;!?…-])`, "gi");
/** Leading words that mean nothing when nothing follows them ("well, maybe."). */
/** "Ace" heard, or spelled "A C E": always written AIC (the owner's rule, 2026-11-09; Transcribe does the same
 * through its vocabulary, this covers Nova Sonic, the browser's recogniser and the iPhone). */
const ACE = /\b(?:ace|a[-. ]c[-. ]e)\b/gi;
const SOFT = new Set(["well", "so", "like", "maybe", "actually", "basically", "anyway", "and", "but", "i", "mean"]);

/** Splits text into the parts outside quotes (cleaned) and inside quotes (kept as said). */
function outsideQuotes(text: string, fn: (s: string) => string): string {
  const parts = text.split(/(["“”][^"“”]*["“”])/);
  return parts.map((p, i) => (i % 2 === 1 ? p : fn(p))).join("");
}

function scrub(s: string): string {
  // "we should, um, ship it" reads "we should ship it": a filler set off by commas takes them with it.
  let t = s.replace(ACE, "AIC").replace(BETWEEN_COMMAS, " ").replace(FILLER_WORD, "$1");
  // Cut-off starts: "w- well", "I- I'm" (a fragment, a dash, then the word again).
  t = t.replace(/\b(\w{1,3})-\s+(?=\1)/gi, "");
  // Stammered repeats of the same word: "I I", "the the the", "to, to".
  t = t.replace(/\b(\w+)(?:[\s,]+\1\b)+/gi, "$1");
  // Tidy what the cuts left: doubled commas, a comma before the end, spaces before punctuation.
  t = t
    .replace(/\s*,\s*(?:,\s*)+/g, ", ")
    .replace(/(^|[.!?]\s*)[,;]\s*/g, "$1")
    .replace(/[,;]\s*([.!?]|$)/g, "$1")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s{2,}/g, " ");
  return t;
}

/** The owner's words without fillers and stammers; "" when nothing meaningful is left. */
export function cleanSpeech(text: string): string {
  let t = outsideQuotes(text, scrub).trim();
  t = t.replace(/^[,.;…-]+\s*/, "").trim();
  if (!t) return "";
  const words = t
    .toLowerCase()
    .replace(/["“”][^"“”]*["“”]/g, " quoted ")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.every((w) => SOFT.has(w))) return "";
  // The sentence started with a capital ("Um, so…"): keep one where it now starts. Otherwise as heard.
  const capital = /^\p{Lu}/u.test(text.trim());
  return capital ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
