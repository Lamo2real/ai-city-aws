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
import { SpeechQueue } from "./speech.ts";
import { getVoice, logVoiceError, micProblem } from "./voice.ts";
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
  // Replies already in the chat when the screen opens (restored after a reload) are never read aloud again.
  const spoken = useRef<string | null>(store.get().chat.at(-1)?.id ?? null);

  // AIC's reply being spoken: which line, how much of its text went into the queue, and the queue.
  const talk = useRef<{ id: string; fed: number; queue: SpeechQueue<Blob> | null } | null>(null);
  const stopTalking = useCallback(() => {
    talk.current?.queue?.stop();
    getVoice().stopSpeaking();
  }, []);

  // Read a reply aloud when the speak mode says so for the message it answers. With a voice that can
  // synthesize sentence by sentence, speaking starts with the first complete sentence while the rest streams.
  useEffect(() => {
    const last = chat.at(-1);
    if (!last || last.who !== "ace" || spoken.current === last.id) return;
    // Done talking (or never started): back to idle, unless the owner has already started talking again.
    const after = () => {
      if (store.get().presence === "speaking") store.set({ presence: wakeMode ? "listening" : "idle" });
    };
    if (talk.current?.id !== last.id) {
      const asked = chat.findLast((l) => l.who === "owner" && l.at <= last.at);
      const v = getVoice();
      const say = shouldSpeak(speakMode, asked?.voice);
      const queue =
        say && v.synth && v.play
          ? new SpeechQueue<Blob>(v.synth.bind(v), v.play.bind(v), () => store.set({ presence: "speaking" }))
          : null;
      talk.current = { id: last.id, fed: 0, queue };
      if (say && !queue && last.state !== "done") return; // a voice without synth: speak it whole when done
    }
    const t = talk.current!;
    if (t.queue && last.text.length > t.fed) {
      t.queue.push(last.text.slice(t.fed));
      t.fed = last.text.length;
    }
    if (last.state !== "done") return;
    spoken.current = last.id;
    if (t.queue) return void t.queue.end().finally(after);
    const asked = chat.findLast((l) => l.who === "owner" && l.at <= last.at);
    if (!shouldSpeak(speakMode, asked?.voice)) return void after();
    store.set({ presence: "speaking" });
    void getVoice()
      .speak(last.text)
      .catch(() => undefined)
      .finally(after);
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
        end();
      };
      try {
        stop.current = await getVoice().listen(
          async (text) => {
            if (dictate) return target.current?.onFinal(text);
            if (!wake) {
              end();
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
      if (listening) return end();
      getVoice().prime?.(); // synchronously, inside the tap (Safari)
      void start(false);
    },
    toggleWake: () => {
      if (wakeMode) {
        setWakeMode(false);
        end();
      } else {
        setWakeMode(true);
        getVoice().prime?.();
        void start(true);
      }
    },
    setSpeakMode,
    setMicMode: (m: MicMode) => {
      if (listening && !wakeMode) end(); // a change takes effect on the next tap
      setMicModeState(m);
      saveMicMode(m);
    },
    /** The City view's sound tile: mute, or back to "only when I talk". */
    toggleSound: () => setSpeakMode(speakMode === "never" ? "auto" : "never"),
  };
}
