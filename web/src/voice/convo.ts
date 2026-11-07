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
