// The hands-free conversation loop ("speech to speech"): after VAIC speaks a reply to something the owner said,
// the mic reopens by itself for the next sentence, until the owner taps the mic, says "stop listening", a reply
// goes unspoken (they typed, or speaking is off), or the mic fails. Pure, so the rules are testable.
export type LoopEvent = "voice_sent" | "reply_spoken" | "reply_silent" | "mic_tap" | "stop_phrase" | "problem";

/** The next loop state, and whether the mic should reopen right now. */
export function loopNext(on: boolean, e: LoopEvent): { on: boolean; reopen: boolean } {
  if (e === "voice_sent") return { on: true, reopen: false };
  if (e === "reply_spoken") return { on, reopen: on };
  return { on: false, reopen: false }; // a silent reply, a tap, the stop phrase or a problem all end it
}

/** "stop listening" (and close variants), said on its own, ends the conversation without being sent to VAIC. */
export function isStopPhrase(text: string): boolean {
  return /^\s*(?:please\s+)?(?:stop|quit)\s+(?:listening|the\s+mic(?:rophone)?)[\s.!,]*$/i.test(text);
}

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Whether what the mic heard is VAIC's own reply coming back from the speakers (the mic stays open while VAIC
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

/** Whether a finished reply is the rest of the one the owner talked over: the chat puts the part that streams in
 *  after the owner's new message on a new line, and its finished text starts with what had streamed before the
 *  owner spoke. That answer is to the old question, so it is not read aloud (the owner, 2026-11-09: "it should
 *  only answer what I'm saying"). */
export function isReplyTail(cut: string, done: string): boolean {
  const a = words(cut).join(" ");
  if (a.split(" ").length < 3) return false; // too little streamed to tell: speak it rather than drop an answer
  return words(done).join(" ").startsWith(a);
}
