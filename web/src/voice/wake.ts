// The browser half of the wake word: plain matching decides most transcripts on the spot; only
// unclear ones go to the server, which asks Haiku. Kept in step with backend/src/aic/shared/utility.py
// (tests on both sides check tests/fixtures/wake-cases.json).
const GREETING = String.raw`(?:yo|hi|hey|hello|hiya|ok|okay|morning|good (?:morning|afternoon|evening)|what'?s up|whats up|sup|how'?s it going|hows it going)`;
const NAME = String.raw`(?:vaic|v\.?\s?a\.?\s?i\.?\s?c\.?|vice|vais|aic|a\.?\s?i\.?\s?c\.?|ace)`; // written VAIC, said "Vice"; the old AIC/"Ace" still count
const ADDRESSED = new RegExp(String.raw`^\s*(?:${GREETING}[\s,!.]*)?${NAME}\b`, "i");
const ENDS_WITH_NAME = new RegExp(String.raw`[,\s]${NAME}[\s?.!]*$`, "i");
const MENTIONS = new RegExp(String.raw`\b${NAME}\b`, "i");

export function wakeMatch(transcript: string): "yes" | "no" | "unclear" {
  const t = transcript.trim().replace(/[“”"]/g, "");
  if (!t) return "no";
  if (ADDRESSED.test(t) || ENDS_WITH_NAME.test(t)) return "yes";
  return MENTIONS.test(t) ? "unclear" : "no";
}
