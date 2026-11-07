// Turning AIC's streamed reply into natural speech, sentence by sentence, so it starts talking as soon as the
// first sentence is complete instead of reading the whole page at the end.
//   SentenceSplitter: cuts the arriving text at sentence ends and line ends; skips code blocks and table rules.
//   speakable:        what a person would say: no Markdown, emoji or URLs; "AIC" said as letters.
//   SpeechQueue:      synthesizes one sentence at a time (ahead of playback, so the next clip is ready when the
//                     current one ends) and plays the clips strictly in order. Polly is never hit in parallel.
// No SSML: Polly's generative voices ignore most of it, and plain short sentences sound most natural.

/** Sentence end: . ! ? … (optionally closed by a quote or bracket) followed by whitespace. */
const SENTENCE_END = /[.!?…]+["'”’)\]]*\s/;
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
    .replace(/\bAIC\b/g, "A.I.C.") // said as letters, never "Ace"
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
  return /[\p{L}\p{N}]/u.test(t) ? t : "";
}

export class SpeechQueue<Clip> {
  private split = new SentenceSplitter();
  private synthChain: Promise<unknown> = Promise.resolve();
  private playChain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private synth: (text: string) => Promise<Clip | null>,
    private play: (clip: Clip) => Promise<void>,
    private onStart?: () => void,
    /** A sentence failed to synthesize or play. The queue carries on with the rest; the caller decides. */
    private onProblem?: (e: unknown) => void,
  ) {}

  /** More of the reply arrived. */
  push(text: string) {
    for (const s of this.split.push(text)) this.say(s);
  }
  /** The reply is complete; resolves when the last clip has played (or the queue was stopped). */
  end(): Promise<void> {
    for (const s of this.split.flush()) this.say(s);
    return this.playChain;
  }
  /** Stop talking now (the owner tapped the mic, or turned speaking off). */
  stop() {
    this.stopped = true;
  }

  private say(sentence: string) {
    const text = speakable(sentence);
    if (!text) return;
    // One synthesis at a time, started as soon as the previous one finished: the next clip is usually ready
    // before the current one ends.
    const clip = this.synthChain.then(() =>
      this.stopped ? null : this.synth(text).catch((e: unknown) => (this.onProblem?.(e), null)),
    );
    this.synthChain = clip;
    this.playChain = this.playChain.then(async () => {
      const c = await clip;
      if (!c || this.stopped) return;
      this.onStart?.();
      await this.play(c).catch((e: unknown) => this.onProblem?.(e));
    });
  }
}
