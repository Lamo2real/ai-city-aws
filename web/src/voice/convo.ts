// The hands-free conversation loop ("speech to speech"): after AIC speaks a reply to something the owner said,
// the mic reopens by itself for the next sentence, until the owner taps the mic, says "stop listening", a reply
// goes unspoken (they typed, or speaking is off), or the mic fails. Pure, so the rules are testable.
export type LoopEvent = "voice_sent" | "reply_spoken" | "reply_silent" | "mic_tap" | "stop_phrase" | "problem";

/** The next loop state, and whether the mic should reopen right now. */
export function loopNext(on: boolean, e: LoopEvent): { on: boolean; reopen: boolean } {
  if (e === "voice_sent") return { on: true, reopen: false };
  if (e === "reply_spoken") return { on, reopen: on };
  return { on: false, reopen: false }; // a silent reply, a tap, the stop phrase or a problem all end it
}

/** "stop listening" (and close variants), said on its own, ends the conversation without being sent to AIC. */
export function isStopPhrase(text: string): boolean {
  return /^\s*(?:please\s+)?(?:stop|quit)\s+(?:listening|the\s+mic(?:rophone)?)[\s.!,]*$/i.test(text);
}

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Whether what the mic heard is AIC's own reply coming back from the speakers (the mic stays open while AIC
 *  talks): most of the heard words are words of the reply. Short owner interjections ("wait", "stop") that
 *  are not in the reply always count as the owner. */
export function isEcho(heard: string, reply: string): boolean {
  const h = words(heard);
  if (!h.length) return true;
  const r = new Set(words(reply));
  if (!r.size) return false;
  const inReply = h.filter((w) => r.has(w)).length;
  return inReply / h.length >= 0.7;
}
