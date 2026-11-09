// Voice for the VAIC screen and the City view's big mic button. Typed and spoken turns go into the same chat.
//   voice conversation: the VAIC screen's voice button (decision 112). Tap once and it stays on: the mic listens,
//                       what you said is sent when you stop talking, VAIC answers aloud, the mic opens again, and
//                       so on until you tap it off (or say "stop listening"). Speech to speech, nothing to type.
//   dictate (the box):  the dictate icon beside Send: the words go into the box (live partials too) until you tap
//                       again; nothing is sent by itself, and the answer to a dictated message is text only.
//   the City's mic:     tap, talk, sent when you stop talking; the answer is spoken unless the City is muted.
// The voice conversation runs on Nova 2 Sonic when it can (decision 120, sonic.ts): real-time, the owner can talk
// over VAIC and it stops at once, short spoken cues while VAIC works. Sonic is only the voice; every request is
// an ordinary VAIC turn. When Sonic cannot start, the step-by-step loop above takes over.
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { store, useHud } from "../lib/store.ts";
import { readSpeakMode, saveSpeakMode, shouldSpeak, type SpeakMode } from "./modes.ts";
import { browserSpeak, browserStopSpeaking, browserVoiceAvailable, usingBrowserVoice } from "./browserSpeech.ts";
import { isReplyTail, isStopPhrase, loopNext } from "./convo.ts";
import { duringAic, isOwnerSpeech, stripEcho, type Span } from "./heard.ts";
import { SpeechQueue } from "./speech.ts";
import { loadOpenAi, onVoiceNote, withOpenAi } from "./openai.ts";
import { toast } from "../components/ui.tsx";
import { getVoice, logVoiceError, micProblem, speakProblem } from "./voice.ts";
import { watchForBargeIn } from "./bargeIn.ts";
import { cleanSpeech } from "./clean.ts";
import { CUE_AFTER_MS, CUE_AGAIN_MS, MAX_CUES, OWNER_TALKING_LEVEL, nextCue } from "./cues.ts";
import { primeSonic, sonicWanted, startSonic, type SonicCall, type SonicHandlers } from "./sonic.ts";
import { liveWanted, startLive as startGptLive } from "./live.ts";

/** Where dictated words go: each partial while talking, then each final piece. */
export interface DictationTarget {
  onPartial(text: string): void;
  onFinal(text: string): void;
  /** Dictation stopped: drop any partial that never became final. */
  onStop(): void;
}

// VAIC's reply being spoken: which line, its queue, whether the owner asked by voice, whether anything has
// actually played, the first failure, and whether it was cut off. Kept outside React (one player for the
// whole page, shared by the VAIC and City screens), so re-renders and switching screens never restart or
// double a reply.
type Talker = Pick<SpeechQueue<unknown>, "update" | "end" | "stop">;
interface Talk {
  id: string;
  queue: Talker | null;
  askedVoice: boolean;
  started: boolean;
  problem: unknown;
  cancelled: boolean;
}
const talk: { current: Talk | null } = { current: null };
// The hands-free loop: armed by a spoken send; while armed, the mic reopens after each spoken reply.
const loop = { current: false };
// The voice conversation (the VAIC screen's voice button): on until the owner taps it off.
const convo = { current: false };
const startRef: { current: ((reopened?: boolean) => void) | null } = { current: null };
// The pieces of what the owner is saying, joined into one message after a short pause (voice conversation).
const THOUGHT_PAUSE_MS = 1100;
const thought: { parts: string[]; timer: number | undefined } = { parts: [], timer: undefined };
// The real-time call while it runs (one for the whole page).
const sonic: { current: SonicCall | null } = { current: null };
/** Loudness of the real-time call, for the visualizer; null when no call runs. */
export const sonicLevels = () => sonic.current?.levels() ?? null;
const lineId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
// Replies already in the chat when the page opens (restored after a reload) are never read aloud again.
const spoken: { current: string | null | undefined } = { current: undefined };

// Thinking cues in the standard voice (cues.ts): the timer, and the last cue said (so its echo is not sent).
const cue: { timer: number | undefined; last: string; at: number } = { timer: undefined, last: "", at: 0 };
function stopCues() {
  window.clearTimeout(cue.timer);
  cue.timer = undefined;
}
/** Says one short cue with whatever voice VAIC is using; never throws. While it plays, VAIC counts as audible, so
 *  the cue coming back from the speakers is judged like the reply's echo (heard.ts), never sent as the owner's. */
function sayCue(text: string) {
  cue.last = text;
  cue.at = Date.now();
  const v = getVoice();
  const begin = () => aicSpeaks();
  // The cue is over; unless a reply is playing by now (it shares the same open span), VAIC is quiet again.
  const done = (p: Promise<unknown>) =>
    void p.catch(() => undefined).finally(() => store.get().presence !== "speaking" && aicQuiet());
  if (usingBrowserVoice() && browserVoiceAvailable()) return done(browserSpeak(text, begin));
  if (v.synth && v.play) {
    const synth = withOpenAi(v.synth.bind(v));
    return done(synth(text).then((clip) => (clip ? v.play!(clip, begin) : undefined)));
  }
  begin();
  done(v.speak(text));
}

// While VAIC talks in a voice conversation, a quiet listener for the owner talking over it (bargeIn.ts), and when
// the owner last cut VAIC off that way (their interrupting phrase is then taken even if it is short).
const barge: { current: (() => void) | null; at: number | null } = { current: null, at: null };
// The streamed text of a reply the owner talked over while it was still arriving: the rest of it lands on a new
// line after the owner's message, and is not read aloud (isReplyTail, convo.ts).
const cut = { text: "" };
function stopBargeIn() {
  barge.current?.();
  barge.current = null;
}

/** Cuts VAIC off: drops the reply's queue, stops the clip playing now and any browser voice. */
// When VAIC's voice was audible, so its echo from the speakers is never taken for the owner (heard.ts).
const spans: Span[] = [];
function aicSpeaks() {
  if (spans.at(-1)?.end === Infinity) return;
  spans.push({ start: Date.now(), end: Infinity });
  while (spans.length > 8) spans.shift();
}
function aicQuiet() {
  const s = spans.at(-1);
  if (s && s.end === Infinity) s.end = Date.now();
}
/** What VAIC last said (its reply, or a thinking cue), for telling its echo from the owner's words. */
function aicWords(): string {
  return `${store.get().chat.findLast((l) => l.who === "ace")?.text ?? ""} ${cue.last ?? ""}`;
}

function stopTalking() {
  aicQuiet();
  stopBargeIn();
  const t = talk.current;
  if (t) {
    t.cancelled = true;
    t.queue?.stop();
  }
  getVoice().stopSpeaking();
  browserStopSpeaking();
  if (store.get().presence === "speaking") store.set({ presence: "idle" });
}

/** GPT-Live's requests (live.ts): sent to VAIC as a spoken chat message; resolves with VAIC's answer when it is
 *  done, or a short note when it fails or takes longer than two minutes (the answer still lands in the chat). */
function askAic(text: string): Promise<string> {
  const before = store.get().chat.length;
  void sendMessage(text, { voice: true });
  return new Promise((resolve) => {
    let off: () => void = () => undefined;
    const settle = (answer: string) => {
      window.clearTimeout(timer);
      off();
      resolve(answer);
    };
    const timer = window.setTimeout(
      () => settle("VAIC is still working on it. The answer will be in the chat."),
      120_000,
    );
    const check = () => {
      const fresh = store.get().chat.slice(before);
      const answer = fresh.find((l) => l.who === "ace" && l.state === "done");
      if (answer) return settle(answer.text);
      if (fresh.some((l) => l.who === "owner" && l.state === "failed"))
        settle("The message didn't reach VAIC. Check the connection.");
    };
    off = store.subscribe(check);
    check();
  });
}

export function useVoice(dictation?: DictationTarget) {
  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState(convo.current);
  const [speakMode, setSpeakModeState] = useState<SpeakMode>(readSpeakMode);
  const [dictatingNow, setDictatingNow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Which voice the conversation runs on, and why the standard one when the real-time one could not start.
  const [engine, setEngine] = useState<{ kind: "realtime" | "standard"; why?: string } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const dictating = useRef(false);
  const target = useRef(dictation);
  target.current = dictation;
  const chat = useHud((s) => s.chat);
  if (spoken.current === undefined) spoken.current = store.get().chat.at(-1)?.id ?? null;

  // OpenAI's voice: whether its key is in (once per page), and a one-time note if it fails and Polly takes over.
  useEffect(() => {
    void loadOpenAi();
    return onVoiceNote(setProblem);
  }, []);

  // Read a reply aloud when the speak mode says so for the message it answers. With a voice that can
  // synthesize sentence by sentence, speaking starts with the first complete sentence while the rest streams.
  useEffect(() => {
    const last = chat.at(-1);
    // VAIC goes into thinking on a spoken message in the voice conversation: after a moment without an answer,
    // a short cue ("Hmm, let me think."), then another now and then while it keeps working.
    stopCues();
    if (last?.who === "owner" && last.voice && convo.current && !sonic.current && !dictating.current) {
      let n = 0;
      const tick = () => {
        const now = store.get().chat.at(-1);
        if (!convo.current || sonic.current || now?.id !== last.id || n >= MAX_CUES) return stopCues();
        // Never over the owner's words: while they are still talking, wait a moment and look again.
        if ((getVoice().levels?.().input ?? 0) > OWNER_TALKING_LEVEL) {
          cue.timer = window.setTimeout(tick, 400);
          return;
        }
        sayCue(nextCue(n++));
        cue.timer = window.setTimeout(tick, CUE_AGAIN_MS);
      };
      cue.timer = window.setTimeout(tick, CUE_AFTER_MS);
    }
    // The owner sent something new (typed or spoken): whatever VAIC was still saying stops.
    if (last?.who === "owner" && talk.current && !talk.current.cancelled && talk.current.id !== last.id) {
      stopTalking();
      return;
    }
    if (!last || last.who !== "ace" || spoken.current === last.id) return;
    // In a real-time call Sonic already says the answer: nothing is read aloud a second time.
    if (sonic.current) {
      if (last.state === "done") spoken.current = last.id;
      return;
    }
    // The owner talked over a reply that was still arriving: the next reply line may be the rest of that old
    // answer. Wait until it is complete, then say it only if it is not (the owner's new question comes next).
    if (cut.text && convo.current && talk.current?.id !== last.id) {
      if (last.state !== "done") return;
      const tail = isReplyTail(cut.text, last.text);
      cut.text = "";
      if (tail) {
        spoken.current = last.id;
        if (store.get().presence !== "listening" && stop.current) store.set({ presence: "listening" });
        return;
      }
    }
    // Done talking: with the hands-free loop on after a spoken reply, the mic reopens for the owner's next
    // sentence; otherwise back to idle. In the voice conversation the mic stays open throughout.
    const finish = (t: Talk, spokenAloud: boolean, askedVoice: boolean) => {
      aicQuiet();
      if (t.cancelled || talk.current !== t) return; // cut off: whoever cut it off decides what's next
      stopBargeIn();
      const next = loopNext(loop.current, spokenAloud && askedVoice ? "reply_spoken" : "reply_silent");
      loop.current = next.on;
      // In a voice conversation the mic always opens again after VAIC's answer; otherwise the City's loop decides.
      // In a voice conversation the mic never closed: VAIC simply goes back to listening.
      if (convo.current && stop.current && !dictating.current) {
        store.set({ presence: "listening" });
        return;
      }
      if ((convo.current || next.reopen) && !dictating.current) {
        getVoice().prime?.(); // best effort outside a tap; Safari may still want one (noted in PRODUCT.md)
        startRef.current?.(true);
        return;
      }
      if (store.get().presence === "speaking") store.set({ presence: "idle" });
    };
    if (talk.current?.id !== last.id) {
      if (talk.current && !talk.current.cancelled) stopTalking(); // a new reply: the old one stops, queue and all
      const asked = chat.findLast((l) => l.who === "owner" && l.at <= last.at);
      const v = getVoice();
      // A voice conversation always answers aloud; otherwise only a message said into the City's mic is.
      const say = convo.current || shouldSpeak(speakMode, asked?.voice);
      // In a voice conversation the mic stays open while VAIC talks (the owner's wish: always listening); its own
      // voice is told apart by echo cancellation and isEcho (convo.ts).
      const t: Talk = {
        id: last.id,
        queue: null,
        askedVoice: asked?.voice === true,
        started: false,
        problem: null,
        cancelled: false,
      };
      // Polly failed earlier this session: the browser's own voice speaks, sentence by sentence, instead.
      const engine =
        usingBrowserVoice() && browserVoiceAvailable()
          ? { synth: async (s: string) => s, play: (s: string, onBegin?: () => void) => browserSpeak(s, onBegin) }
          : v.synth && v.play
            ? { synth: withOpenAi(v.synth.bind(v)), play: v.play.bind(v) } // OpenAI when its key is in
            : null;
      if (say && engine)
        t.queue = new SpeechQueue(
          engine.synth as (s: string) => Promise<unknown>,
          engine.play as (c: unknown, onBegin?: () => void) => Promise<void>,
          () => {
            if (t.cancelled) return;
            t.started = true;
            aicSpeaks();
            store.set({ presence: "speaking" });
          },
          (e) => {
            t.problem ??= e;
            logVoiceError("the reply could not be spoken", e);
          },
        );
      talk.current = t;
      // Talking over VAIC stops it at once and opens the mic (in the voice conversation).
      if (say && convo.current && !dictating.current) {
        stopBargeIn();
        barge.current = watchForBargeIn(
          () => {
            barge.current = null;
            if (talk.current !== t || t.cancelled || !convo.current) return;
            barge.at = Date.now();
            stopTalking(); // silent at once; the open mic already hears the owner
            if (stop.current) store.set({ presence: "listening" });
            else startRef.current?.(true);
          },
          () => getVoice().micLevel?.() ?? null, // the open mic's own level: no second microphone
        );
      }
      if (say && !t.queue && last.state !== "done") return; // a voice without synth: speak it whole when done
    }
    const t = talk.current!;
    if (t.cancelled) return;
    if (last.state !== "done") return void t.queue?.update(last.text);
    spoken.current = last.id;
    if (t.queue) {
      const text = last.text;
      return void t.queue
        .end(text) // the finished text can differ from what streamed; no sentence is said twice
        .then(async () => {
          if (t.cancelled) return;
          if (t.started || !t.problem) {
            if (t.problem) setProblem(speakProblem(t.problem)); // part of it played; say why the rest did not
            return;
          }
          // Nothing played at all (Polly refused, or the clip was blocked): the browser's own voice takes
          // over for the rest of this page session, like the recognition fallback.
          // Only for this reply: the next one tries VAIC's own voice again (a sticky switch once left Safari silent
          // for the whole visit, the owner, 2026-11-09).
          if (!usingBrowserVoice() && browserVoiceAvailable()) {
            const q = new SpeechQueue<string>(
              async (s) => s,
              (s, onBegin) => browserSpeak(s, onBegin),
              () => {
                if (t.cancelled) return;
                t.started = true;
                aicSpeaks();
                store.set({ presence: "speaking" });
              },
            );
            t.queue = q; // a mic tap can still stop it
            await q.end(text);
            if (!t.started && !t.cancelled) setProblem(speakProblem(t.problem)); // the browser's voice was silent too
          } else setProblem(speakProblem(t.problem));
        })
        .finally(() => finish(t, t.started, t.askedVoice));
    }
    if (!convo.current && !shouldSpeak(speakMode, t.askedVoice)) return void finish(t, false, t.askedVoice);
    store.set({ presence: "speaking" });
    void getVoice()
      .speak(last.text)
      .then(
        () => finish(t, true, t.askedVoice),
        (e: unknown) => {
          logVoiceError("the reply could not be spoken", e);
          setProblem(speakProblem(e));
          finish(t, false, t.askedVoice);
        },
      );
  }, [chat, speakMode]);

  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    if (dictating.current) target.current?.onStop();
    dictating.current = false;
    setDictatingNow(false);
    setListening(false);
    if (store.get().presence === "listening") store.set({ presence: "idle" });
  }, []);

  const endConversation = useCallback(() => {
    stopCues();
    window.clearTimeout(thought.timer); // a half-said thought is dropped with the conversation
    thought.parts = [];
    cut.text = "";
    barge.at = null;
    convo.current = false;
    setEngine(null);
    setConversation(false);
  }, []);

  const start = useCallback(
    async (reopened = false, intoBox = false) => {
      if (!reopened) setProblem(null); // the mic reopening keeps what the voice line says
      stopTalking();
      const dictate = intoBox && !!target.current;
      const failed = (where: string, e: unknown) => {
        logVoiceError(where, e);
        setProblem(micProblem(e));
        loop.current = false; // a mic problem ends the hands-free loop and the conversation
        endConversation();
        end();
      };
      try {
        // What the owner says, as one thought: in the voice conversation the pieces heard between short pauses
        // are joined until the owner has been quiet for a moment, so "They" + "I take that." go as one message.
        const said = (raw: string) => {
          const text = cleanSpeech(raw); // no "um", "uh", stammers; quoted words stay as said
          if (!text) return;
          if (isStopPhrase(text)) {
            loop.current = false; // "stop listening" ends the conversation and is not sent
            endConversation();
            end();
            return;
          }
          if (convo.current) {
            // Always listening. VAIC's own voice was already told apart from the owner's, piece by piece, when
            // it was heard (isOwnerSpeech); what reaches here is the owner's, said now, and is answered as said.
            // (A check here against VAIC's last reply, even after it had finished, once dropped answers like
            // "yes, send the email to John" for repeating VAIC's words.)
            const now = store.get().chat.at(-1);
            if (now?.who === "ace") cut.text = now.state === "streaming" ? now.text : "";
            stopTalking();
            return void sendMessage(text, { voice: true });
          }
          end();
          loop.current = loopNext(loop.current, "voice_sent").on; // the loop arms on a spoken send
          void sendMessage(text, { voice: true });
        };
        const flush = () => {
          window.clearTimeout(thought.timer);
          const whole = thought.parts.join(" ");
          thought.parts = [];
          if (whole) said(whole);
        };
        stop.current = await getVoice().listen(
          async (text, heard) => {
            if (dictate) {
              const clean = cleanSpeech(text);
              return clean ? target.current?.onFinal(clean) : undefined;
            }
            if (!convo.current) return said(text);
            // VAIC's own voice coming back from the speakers is not the owner (the owner, 2026-11-09).
            const startedAt = heard?.startedAt ?? null;
            const aic = aicWords();
            if (!isOwnerSpeech(text, aic, startedAt, spans, { bargedAt: barge.at })) return;
            // Said over VAIC: VAIC's last words that Transcribe joined to the front of the owner's are cut off.
            const overlapped = startedAt === null ? spans.some((s) => s.end === Infinity) : duringAic(startedAt, spans);
            if (overlapped) text = stripEcho(text, aic);
            if (!text) return;
            if (isStopPhrase(cleanSpeech(text))) {
              thought.parts = []; // "stop listening" acts at once, never joined to what follows
              return said(text);
            }
            thought.parts.push(text);
            window.clearTimeout(thought.timer);
            thought.timer = window.setTimeout(flush, THOUGHT_PAUSE_MS);
          },
          dictate
            ? (text) => target.current?.onPartial(cleanSpeech(text))
            : (text) => {
                // The owner talks over VAIC with words of their own: VAIC stops at once.
                const t = talk.current;
                if (
                  convo.current &&
                  t &&
                  t.started &&
                  !t.cancelled &&
                  isOwnerSpeech(text, aicWords(), null, spans, { partial: true })
                ) {
                  barge.at = Date.now();
                  stopTalking();
                  store.set({ presence: "listening" });
                }
                // Still talking: wait for the end of the thought before sending.
                if (text.trim() && thought.parts.length) {
                  window.clearTimeout(thought.timer);
                  thought.timer = window.setTimeout(flush, THOUGHT_PAUSE_MS);
                }
              },
          (e) => failed("listening stopped", e),
        );
        dictating.current = dictate;
        setDictatingNow(dictate);
        setListening(true);
        store.set({ presence: "listening" });
      } catch (e) {
        failed("the microphone could not start", e);
      }
    },
    [end, endConversation],
  );
  startRef.current = (reopened?: boolean) => void start(reopened);

  const stopLive = useCallback(() => {
    sonic.current?.stop();
    sonic.current = null;
  }, []);

  /** The voice conversation on Nova Sonic; falls back to the step-by-step loop when it cannot start. */
  const startLive = useCallback(async () => {
    setProblem(null);
    stopTalking();
    end();
    store.set({ presence: "thinking" });
    const add = (who: "owner" | "ace", text: string) => {
      const line = { id: lineId(), who, text, at: Date.now(), state: who === "owner" ? "sent" : "done" } as const;
      store.set({ chat: [...store.get().chat, who === "owner" ? { ...line, voice: true } : line] });
      if (who === "owner") store.beginTurn();
      else spoken.current = line.id;
    };
    const presence = (p: "listening" | "thinking" | "speaking") => sonic.current && store.set({ presence: p });
    let liveWhy = ""; // why GPT-Live didn't open, shown with Nova Sonic's reason when both fail
    try {
      const handlers: SonicHandlers = {
        onUserText: (raw) => {
          const text = cleanSpeech(raw); // the chat shows what the owner meant, without "um" and stammers
          if (!text) return;
          if (!isStopPhrase(text)) return add("owner", text);
          endConversation(); // "stop listening" ends the call and is not sent
          stopLive();
          setListening(false);
          store.set({ presence: "idle" });
        },
        // VAIC's own answer reaches the chat from VAIC; only Sonic's small talk (a greeting, "sure") is added here.
        onAssistantText: (text, aic) => !aic && add("ace", text),
        onThinking: (on) => presence(on ? "thinking" : "listening"),
        onSpeaking: (on) => presence(on ? "speaking" : "listening"),
        onEnd: (e) => {
          sonic.current = null;
          if (e && convo.current) {
            // The call broke: say why and carry on with the standard voice instead of going silent.
            logVoiceError("the voice call stopped", e);
            const why = ((e as Error).message ?? "").trim().replace(/\.$/, "").slice(0, 160);
            setEngine({ kind: "standard", why: why || "no reason given" });
            toast({
              text: `Real-time voice stopped${why ? ` (${why})` : ""}, so VAIC is using its standard voice.`,
              tone: "info",
            });
            getVoice().prime?.();
            return void start();
          }
          endConversation();
          setListening(false);
          store.set({ presence: "idle" });
          if (e) {
            logVoiceError("the voice call stopped", e);
            setProblem(`${(e as Error).message || "VAIC's voice stopped."} Tap the voice button to talk again.`);
          }
        },
      };
      const quiet = () => {
        endConversation(); // "stop listening" ends the call and is not sent
        stopLive();
        setListening(false);
        store.set({ presence: "idle" });
      };
      // The most natural voice first (GPT-Live, decision 128); Nova Sonic when it can't open (no key, no access).
      let call: SonicCall;
      try {
        if (!liveWanted()) throw new Error("not in this browser");
        call = await startGptLive({
          ask: (raw) => {
            const text = cleanSpeech(raw) || raw.trim();
            if (!isStopPhrase(text)) return askAic(text);
            quiet();
            return Promise.resolve("");
          },
          onUserWords: (w) => isStopPhrase(cleanSpeech(w)) && quiet(),
          onThinking: handlers.onThinking,
          onSpeaking: handlers.onSpeaking,
          onEnd: handlers.onEnd,
        });
      } catch (e) {
        if (!convo.current) return;
        logVoiceError("GPT-Live could not start; trying Nova Sonic", e);
        // No OpenAI key is a choice, not a fault: GPT-Live is then simply skipped without a word.
        const notSetUp =
          (e as { status?: number } | null)?.status === 503 && /set up/i.test((e as Error)?.message ?? "");
        if (liveWanted() && !notSetUp)
          liveWhy = ((e as Error | null)?.message ?? "").trim().replace(/\.$/, "").slice(0, 120) || "no reason given";
        call = await startSonic(handlers);
      }
      if (!convo.current) return call.stop(); // tapped off while it was connecting
      sonic.current = call;
      setEngine({ kind: "realtime" });
      setListening(true);
      store.set({ presence: "listening" });
    } catch (e) {
      logVoiceError("the real-time voice could not start; using the step-by-step voice", e);
      if (store.get().presence === "thinking") store.set({ presence: "idle" });
      if (!convo.current) return;
      if ((e as { name?: string } | null)?.name === "NotAllowedError") {
        setProblem(micProblem(e));
        return endConversation();
      }
      // Say why, in one line, so it can be fixed; the standard voice carries on meanwhile.
      const sonicWhy = ((e as Error | null)?.message ?? "").trim().replace(/\.$/, "").slice(0, 160);
      const why = liveWhy ? `GPT-Live: ${liveWhy}. Nova Sonic: ${sonicWhy || "no reason given"}` : sonicWhy;
      setEngine({ kind: "standard", why: why || "no reason given" });
      toast({
        text: `Real-time voice didn't connect${why ? ` (${why})` : ""}, so VAIC is using its standard voice.`,
        tone: "info",
      });
      getVoice().prime?.();
      void start();
    }
  }, [end, endConversation, start, stopLive]);

  const setSpeakMode = (m: SpeakMode) => {
    setSpeakModeState(m);
    saveSpeakMode(m);
    if (m === "never") stopTalking();
  };

  return {
    listening,
    /** The voice conversation is on (the VAIC screen's voice button). */
    conversation,
    /** Which voice the conversation runs on, and why the standard one, for the voice bar. */
    engine,
    speakMode,
    /** Listening into the message box (the dictate icon), not to send. */
    dictating: listening && dictatingNow,
    /** For the City view's sound tile: anything but "never". */
    sound: speakMode !== "never",
    problem,
    pushToTalk: () => {
      if (listening) {
        loop.current = false; // a tap while listening ends the hands-free loop
        return end();
      }
      getVoice().prime?.(); // synchronously, inside the tap (Safari)
      void start();
    },
    /** The VAIC screen's voice button: a speech-to-speech conversation, on until tapped off. */
    toggleConversation: () => {
      if (convo.current) {
        loop.current = false;
        endConversation();
        stopLive();
        stopTalking();
        return end();
      }
      convo.current = true;
      setConversation(true);
      // Synchronously, inside the tap (Safari): the real-time voices' audio, and the standard voice's too, which takes
      // over when they can't connect; primed later, outside the tap, Safari keeps it silent.
      getVoice().prime?.();
      if (sonicWanted()) {
        primeSonic();
        return void startLive();
      }
      setEngine({ kind: "standard" });
      getVoice().prime?.(); // synchronously, inside the tap (Safari)
      if (!listening) void start();
    },
    /** The dictate icon in the message box: words go into the box until tapped again. */
    toggleDictate: () => {
      const wasDictating = dictating.current;
      if (listening) {
        loop.current = false;
        end();
        if (wasDictating) return;
      }
      loop.current = false; // dictation never arms the hands-free loop, and it ends a voice conversation
      endConversation();
      stopLive();
      getVoice().prime?.();
      void start(false, true);
    },
    setSpeakMode,
    /** The City view's sound tile: mute, or back to "only when I talk". */
    toggleSound: () => setSpeakMode(speakMode === "never" ? "auto" : "never"),
  };
}
