// Push-to-talk, dictation, the optional wake-word mode, and spoken replies, shared by the AIC screen and the
// City view's big mic button. Typed and spoken turns go into the same conversation.
//   mic mode "send":    tap, talk; what was said is sent when you stop talking (counts as voice).
//   mic mode "dictate": tap, talk; the words go to the message box (live partials too) until you tap again;
//                       nothing is sent automatically. Only screens that pass a dictation target offer it.
//   speaking:           "auto" reads a reply aloud only when the message it answers came in by voice.
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { api } from "../lib/api.ts";
import { store, useHud } from "../lib/store.ts";
import {
  readMicMode,
  readSpeakMode,
  saveMicMode,
  saveSpeakMode,
  shouldSpeak,
  type MicMode,
  type SpeakMode,
} from "./modes.ts";
import {
  browserSpeak,
  browserStopSpeaking,
  browserVoiceAvailable,
  rememberBrowserVoice,
  usingBrowserVoice,
} from "./browserSpeech.ts";
import { isStopPhrase, loopNext } from "./convo.ts";
import { SpeechQueue } from "./speech.ts";
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

export function useVoice(dictation?: DictationTarget) {
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [speakMode, setSpeakModeState] = useState<SpeakMode>(readSpeakMode);
  const [micMode, setMicModeState] = useState<MicMode>(readMicMode);
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const dictating = useRef(false);
  const target = useRef(dictation);
  target.current = dictation;
  const chat = useHud((s) => s.chat);
  // The hands-free loop: armed by a spoken send; while armed, the mic reopens after each spoken reply.
  const loop = useRef(false);
  const startRef = useRef<((wake: boolean) => void) | null>(null);
  const micModeRef = useRef(micMode);
  micModeRef.current = micMode;
  // Replies already in the chat when the screen opens (restored after a reload) are never read aloud again.
  const spoken = useRef<string | null>(store.get().chat.at(-1)?.id ?? null);

  // AIC's reply being spoken: which line, how much went into the queue, the queue, whether the owner asked by
  // voice, whether anything has actually played, and the first failure.
  type Talker = Pick<SpeechQueue<unknown>, "push" | "end" | "stop">;
  const talk = useRef<{
    id: string;
    fed: number;
    queue: Talker | null;
    askedVoice: boolean;
    started: boolean;
    problem: unknown;
  } | null>(null);
  const stopTalking = useCallback(() => {
    talk.current?.queue?.stop();
    getVoice().stopSpeaking();
    browserStopSpeaking();
  }, []);

  // Read a reply aloud when the speak mode says so for the message it answers. With a voice that can
  // synthesize sentence by sentence, speaking starts with the first complete sentence while the rest streams.
  useEffect(() => {
    const last = chat.at(-1);
    if (!last || last.who !== "ace" || spoken.current === last.id) return;
    // Done talking: with the hands-free loop on after a spoken reply, the mic reopens for the owner's next
    // sentence; otherwise back to idle. AIC never listens while it talks, so there is no self-echo.
    const finish = (spokenAloud: boolean, askedVoice: boolean) => {
      const next = loopNext(loop.current, spokenAloud && askedVoice ? "reply_spoken" : "reply_silent");
      loop.current = next.on;
      if (next.reopen && micModeRef.current === "send" && !wakeMode && !dictating.current) {
        getVoice().prime?.(); // best effort outside a tap; Safari may still want one (noted in PRODUCT.md)
        startRef.current?.(false);
        return;
      }
      if (store.get().presence === "speaking") store.set({ presence: wakeMode ? "listening" : "idle" });
    };
    if (talk.current?.id !== last.id) {
      const asked = chat.findLast((l) => l.who === "owner" && l.at <= last.at);
      const v = getVoice();
      const say = shouldSpeak(speakMode, asked?.voice);
      const t: NonNullable<typeof talk.current> = {
        id: last.id,
        fed: 0,
        queue: null,
        askedVoice: asked?.voice === true,
        started: false,
        problem: null,
      };
      // Polly failed earlier this session: the browser's own voice speaks, sentence by sentence, instead.
      const engine =
        usingBrowserVoice() && browserVoiceAvailable()
          ? { synth: async (s: string) => s, play: (s: string) => browserSpeak(s) }
          : v.synth && v.play
            ? { synth: v.synth.bind(v), play: v.play.bind(v) }
            : null;
      if (say && engine)
        t.queue = new SpeechQueue(
          engine.synth as (s: string) => Promise<unknown>,
          engine.play as (c: unknown) => Promise<void>,
          () => {
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
    if (t.queue && last.text.length > t.fed) {
      t.queue.push(last.text.slice(t.fed));
      t.fed = last.text.length;
    }
    if (last.state !== "done") return;
    spoken.current = last.id;
    if (t.queue) {
      const text = last.text;
      return void t.queue
        .end()
        .then(async () => {
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
              (s) => browserSpeak(s),
              () => {
                t.started = true;
                store.set({ presence: "speaking" });
              },
            );
            t.queue = q; // a mic tap can still stop it
            q.push(text);
            await q.end();
          } else setProblem(speakProblem(t.problem));
        })
        .finally(() => finish(t.started, t.askedVoice));
    }
    if (!shouldSpeak(speakMode, t.askedVoice)) return void finish(false, t.askedVoice);
    store.set({ presence: "speaking" });
    void getVoice()
      .speak(last.text)
      .then(
        () => finish(true, t.askedVoice),
        (e: unknown) => {
          logVoiceError("the reply could not be spoken", e);
          setProblem(speakProblem(e));
          finish(false, t.askedVoice);
        },
      );
  }, [chat, speakMode, wakeMode]);

  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    if (dictating.current) target.current?.onStop();
    dictating.current = false;
    setListening(false);
    if (store.get().presence === "listening") store.set({ presence: "idle" });
  }, []);

  const start = useCallback(
    async (wake: boolean) => {
      setProblem(null);
      stopTalking();
      const dictate = !wake && micMode === "dictate" && !!target.current;
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
        setListening(true);
        store.set({ presence: "listening" });
      } catch (e) {
        failed("the microphone could not start", e);
      }
    },
    [end, micMode, stopTalking],
  );
  startRef.current = (wake: boolean) => void start(wake);

  const setSpeakMode = (m: SpeakMode) => {
    setSpeakModeState(m);
    saveSpeakMode(m);
    if (m === "never") stopTalking();
  };

  return {
    listening,
    wakeMode,
    speakMode,
    micMode,
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
    setMicMode: (m: MicMode) => {
      if (listening && !wakeMode) end(); // a change takes effect on the next tap
      loop.current = false;
      setMicModeState(m);
      saveMicMode(m);
    },
    /** The City view's sound tile: mute, or back to "only when I talk". */
    toggleSound: () => setSpeakMode(speakMode === "never" ? "auto" : "never"),
  };
}
