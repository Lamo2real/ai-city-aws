// Push-to-talk, dictation, the optional wake-word mode, and spoken replies, shared by the AIC screen and the
// City view's big mic button. Typed and spoken turns go into the same conversation.
//   the mic button:     tap, talk; what was said is sent when you stop talking (counts as voice).
//   dictate (the box):  tap the dictate icon beside Send, talk; the words go to the message box (live partials
//                       too) until you tap again; nothing is sent automatically. Only the AIC screen offers it.
//   speaking:           "auto" reads a reply aloud only when the message it answers came in by voice.
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { api } from "../lib/api.ts";
import { store, useHud } from "../lib/store.ts";
import { readSpeakMode, saveSpeakMode, shouldSpeak, type SpeakMode } from "./modes.ts";
import {
  browserSpeak,
  browserStopSpeaking,
  browserVoiceAvailable,
  rememberBrowserVoice,
  usingBrowserVoice,
} from "./browserSpeech.ts";
import { isStopPhrase, loopNext } from "./convo.ts";
import { SpeechQueue } from "./speech.ts";
import { loadOpenAi, onVoiceNote, withOpenAi } from "./openai.ts";
import { toast } from "../components/ui.tsx";
import { getVoice, logVoiceError, micProblem, speakProblem } from "./voice.ts";
import { wakeMatch } from "./wake.ts";

/** Where dictated words go: each partial while talking, then each final piece. */
export interface DictationTarget {
  onPartial(text: string): void;
  onFinal(text: string): void;
  /** Dictation stopped: drop any partial that never became final. */
  onStop(): void;
}

// AIC's reply being spoken: which line, its queue, whether the owner asked by voice, whether anything has
// actually played, the first failure, and whether it was cut off. Kept outside React (one player for the
// whole page, shared by the AIC and City screens), so re-renders and switching screens never restart or
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
const startRef: { current: ((wake: boolean, reopened?: boolean) => void) | null } = { current: null };
// Replies already in the chat when the page opens (restored after a reload) are never read aloud again.
const spoken: { current: string | null | undefined } = { current: undefined };

/** Cuts AIC off: drops the reply's queue, stops the clip playing now and any browser voice. */
function stopTalking() {
  const t = talk.current;
  if (t) {
    t.cancelled = true;
    t.queue?.stop();
  }
  getVoice().stopSpeaking();
  browserStopSpeaking();
  if (store.get().presence === "speaking") store.set({ presence: "idle" });
}

export function useVoice(dictation?: DictationTarget) {
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [speakMode, setSpeakModeState] = useState<SpeakMode>(readSpeakMode);
  const [dictatingNow, setDictatingNow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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
    // The owner sent something new (typed or spoken): whatever AIC was still saying stops.
    if (last?.who === "owner" && talk.current && !talk.current.cancelled && talk.current.id !== last.id) {
      stopTalking();
      return;
    }
    if (!last || last.who !== "ace" || spoken.current === last.id) return;
    // Done talking: with the hands-free loop on after a spoken reply, the mic reopens for the owner's next
    // sentence; otherwise back to idle. AIC never listens while it talks, so there is no self-echo.
    const finish = (t: Talk, spokenAloud: boolean, askedVoice: boolean) => {
      if (t.cancelled || talk.current !== t) return; // cut off: whoever cut it off decides what's next
      const next = loopNext(loop.current, spokenAloud && askedVoice ? "reply_spoken" : "reply_silent");
      loop.current = next.on;
      if (next.reopen && !wakeMode && !dictating.current) {
        getVoice().prime?.(); // best effort outside a tap; Safari may still want one (noted in PRODUCT.md)
        startRef.current?.(false, true);
        return;
      }
      if (store.get().presence === "speaking") store.set({ presence: wakeMode ? "listening" : "idle" });
    };
    if (talk.current?.id !== last.id) {
      if (talk.current && !talk.current.cancelled) stopTalking(); // a new reply: the old one stops, queue and all
      const asked = chat.findLast((l) => l.who === "owner" && l.at <= last.at);
      const v = getVoice();
      const say = shouldSpeak(speakMode, asked?.voice);
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
            store.set({ presence: "speaking" });
          },
          (e) => {
            t.problem ??= e;
            logVoiceError("the reply could not be spoken", e);
          },
        );
      talk.current = t;
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
          if (!usingBrowserVoice() && browserVoiceAvailable()) {
            rememberBrowserVoice();
            toast({ text: "Using your browser's voice.", tone: "info" });
            const q = new SpeechQueue<string>(
              async (s) => s,
              (s, onBegin) => browserSpeak(s, onBegin),
              () => {
                if (t.cancelled) return;
                t.started = true;
                store.set({ presence: "speaking" });
              },
            );
            t.queue = q; // a mic tap can still stop it
            await q.end(text);
          } else setProblem(speakProblem(t.problem));
        })
        .finally(() => finish(t, t.started, t.askedVoice));
    }
    if (!shouldSpeak(speakMode, t.askedVoice)) return void finish(t, false, t.askedVoice);
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
  }, [chat, speakMode, wakeMode]);

  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    if (dictating.current) target.current?.onStop();
    dictating.current = false;
    setDictatingNow(false);
    setListening(false);
    if (store.get().presence === "listening") store.set({ presence: "idle" });
  }, []);

  const start = useCallback(
    async (wake: boolean, reopened = false, intoBox = false) => {
      if (!reopened) setProblem(null); // the loop reopening the mic keeps what the voice line says
      stopTalking();
      const dictate = !wake && intoBox && !!target.current;
      const failed = (where: string, e: unknown) => {
        logVoiceError(where, e);
        setProblem(micProblem(e));
        setWakeMode(false);
        loop.current = false; // a mic problem ends the hands-free loop
        end();
      };
      try {
        stop.current = await getVoice().listen(
          async (text) => {
            if (dictate) return target.current?.onFinal(text);
            if (!wake) {
              if (isStopPhrase(text)) {
                loop.current = false; // "stop listening" ends the conversation and is not sent
                end();
                return;
              }
              end();
              loop.current = loopNext(loop.current, "voice_sent").on; // the loop arms on a spoken send
              return void sendMessage(text, { voice: true });
            }
            const m = wakeMatch(text);
            const addressed =
              m === "yes" ||
              (m === "unclear" &&
                (await api<{ addressed: boolean }>("/wake-check", { method: "POST", body: { transcript: text } }).then(
                  (r) => r.addressed,
                  () => false,
                )));
            if (addressed) void sendMessage(text, { voice: true });
          },
          dictate ? (text) => target.current?.onPartial(text) : undefined,
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
    [end],
  );
  startRef.current = (wake: boolean, reopened?: boolean) => void start(wake, reopened);

  const setSpeakMode = (m: SpeakMode) => {
    setSpeakModeState(m);
    saveSpeakMode(m);
    if (m === "never") stopTalking();
  };

  return {
    listening,
    wakeMode,
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
      void start(false);
    },
    /** The dictate icon in the message box: words go into the box until tapped again. */
    toggleDictate: () => {
      if (listening) {
        loop.current = false;
        return end();
      }
      loop.current = false; // dictation never arms the hands-free loop
      getVoice().prime?.();
      void start(false, false, true);
    },
    toggleWake: () => {
      if (wakeMode) {
        setWakeMode(false);
        end();
      } else {
        setWakeMode(true);
        loop.current = false; // wake mode has its own always-on loop
        getVoice().prime?.();
        void start(true);
      }
    },
    setSpeakMode,
    /** The City view's sound tile: mute, or back to "only when I talk". */
    toggleSound: () => setSpeakMode(speakMode === "never" ? "auto" : "never"),
  };
}
