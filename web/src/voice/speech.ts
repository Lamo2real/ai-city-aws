// Turning VAIC's streamed reply into natural speech, sentence by sentence, so it starts talking as soon as the
// first sentence is complete instead of reading the whole page at the end.
//   SentenceSplitter: cuts the arriving text at sentence ends and line ends; skips code blocks and table rules.
//   speakable:        what a person would say: no Markdown, emoji or URLs; "VAIC" said as letters.
//   SpeechQueue:      one reply, each sentence once: synthesizes one sentence at a time (ahead of playback, so
//                     the next clip is ready when the current one ends) and plays the clips strictly in order,
//                     with a short pause between them. Polly is never hit in parallel.
// No SSML: Polly's generative voices ignore most of it, and plain short sentences sound most natural.

/** Sentence end: . ! ? … (optionally closed by a quote, a bracket or Markdown emphasis) followed by whitespace. */
const SENTENCE_END = /[.!?…]+["'”’)\]*_]*\s/;
const LIST_MARKER = /^\s*(?:\d+[.)]|[-*+•])\s+/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export class SentenceSplitter {
  private buf = "";
  private inFence = false;
  private atLineStart = true;

  /** Adds streamed text; returns the sentences it completed. */
  push(text: string): string[] {
    this.buf += text;
    const out: string[] = [];
    for (;;) {
      const nl = this.buf.indexOf("\n");
      // A list marker ("1. ", "- ") at the start of a line is not a sentence end.
      const skip = this.atLineStart && !this.inFence ? (LIST_MARKER.exec(this.buf)?.[0].length ?? 0) : 0;
      const m = this.inFence ? null : SENTENCE_END.exec(this.buf.slice(skip));
      const end = m ? skip + m.index + m[0].length : -1;
      if (nl === -1 && end === -1) break;
      if (nl !== -1 && (end === -1 || nl < end)) {
        const line = this.buf.slice(0, nl);
        this.buf = this.buf.slice(nl + 1);
        this.atLineStart = true;
        if (line.trim().startsWith("```")) {
          this.inFence = !this.inFence;
          continue;
        }
        if (this.inFence || TABLE_RULE.test(line)) continue;
        if (line.trim()) out.push(line);
      } else {
        out.push(this.buf.slice(0, end));
        this.buf = this.buf.slice(end);
        this.atLineStart = false;
      }
    }
    return out;
  }

  /** The reply is complete: whatever is left (unless it is inside a code block). */
  flush(): string[] {
    const rest = this.inFence ? "" : this.buf;
    this.buf = "";
    return rest.trim() && !rest.trim().startsWith("```") ? [rest] : [];
  }
}

const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}/gu;

/** One sentence of Markdown as a person would say it. Empty when there is nothing to say. */
export function speakable(md: string): string {
  let t = md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images: their alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links: their words
    .replace(/https?:\/\/\S*[^\s.,!?;:)\]]/g, "a link") // a trailing full stop stays a full stop
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*|__|~~/g, "")
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(LIST_MARKER, "")
    .replace(/^\s*>\s?/, "");
  if (t.includes("|"))
    t = t
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .replace(/\s*\|\s*/g, ", ");
  t = t
    .replace(EMOJI, "")
    .replace(/\bV?AIC\b/g, "Vice") // written VAIC, said "Vice" (the owner's rule, 2026-11-09)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
  return /[\p{L}\p{N}]/u.test(t) ? t : "";
}

/** The pause between two sentences, like a breath (generative voices ignore SSML breaks). */
export const SENTENCE_GAP_MS = 200;

/** Every complete sentence in `text` so far, as it would be said (`done`: the rest counts too). The split
 *  only depends on the text, so a longer version of the same reply gives the same first sentences. */
export function sentencesOf(text: string, done = false): string[] {
  const split = new SentenceSplitter();
  return [...split.push(text), ...(done ? split.flush() : [])].map(speakable).filter(Boolean);
}

/** One reply, spoken once: a strict first-in, first-out player. The queue holds the reply's whole text and
 *  re-splits it on every update, so a piece that arrives twice, a re-render, or a final text that replaces
 *  the streamed one (it can, after a tool call) never re-queues a sentence: each sentence is said at most once,
 *  in order. Synthesis runs one ahead of playback; a clip starts only after the previous one ended. */
export class SpeechQueue<Clip> {
  private text = "";
  private said = new Set<string>();
  private played = 0;
  private synthChain: Promise<unknown> = Promise.resolve();
  private playChain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private synth: (text: string) => Promise<Clip | null>,
    private play: (clip: Clip, onBegin?: () => void) => Promise<void>,
    /** Called when a clip's sound actually starts (not when it is queued or synthesized). */
    private onStart?: () => void,
    /** A sentence failed to synthesize or play. The queue carries on with the rest; the caller decides. */
    private onProblem?: (e: unknown) => void,
    private gapMs = SENTENCE_GAP_MS,
  ) {}

  /** More of the reply arrived. */
  push(more: string) {
    this.update(this.text + more);
  }
  /** The reply so far, whole (what the chat line shows now). */
  update(full: string, done = false) {
    if (this.stopped) return;
    this.text = full;
    for (const s of sentencesOf(full, done)) {
      if (this.said.has(s)) continue;
      this.said.add(s);
      this.say(s);
    }
  }
  /** The reply is complete (`final`: its finished text, if it replaced the streamed one); resolves when the
   *  last clip has played or the queue was stopped. */
  end(final?: string): Promise<void> {
    this.update(final ?? this.text, true);
    return this.playChain;
  }
  /** Stop talking now and drop everything queued (a new reply, the mic, Send, or speaking turned off). */
  stop() {
    this.stopped = true;
  }
  get isStopped() {
    return this.stopped;
  }

  private say(text: string) {
    // One synthesis at a time, started as soon as the previous one finished: the next clip is usually ready
    // before the current one ends.
    const clip = this.synthChain.then(() =>
      this.stopped ? null : this.synth(text).catch((e: unknown) => (this.onProblem?.(e), null)),
    );
    this.synthChain = clip;
    this.playChain = this.playChain.then(async () => {
      const c = await clip;
      if (!c || this.stopped) return;
      if (this.played++ && this.gapMs) await new Promise((r) => setTimeout(r, this.gapMs));
      if (this.stopped) return;
      await this.play(c, this.onStart).catch((e: unknown) => this.onProblem?.(e));
    });
  }
}
