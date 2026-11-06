// Push-to-talk, the optional wake-word mode, and spoken replies, shared by the Ace screen and the
// City view's big mic button. Typed and spoken turns go into the same conversation.
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { api } from "../lib/api.ts";
import { store, useHud } from "../lib/store.ts";
import { getVoice } from "./voice.ts";
import { wakeMatch } from "./wake.ts";

const SOUND_KEY = "aic.sound";
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [sound, setSound] = useState(read(SOUND_KEY) !== "off");
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const chat = useHud((s) => s.chat);
  const spoken = useRef<string | null>(null);

  // Speak each finished reply once, when sound is on.
  useEffect(() => {
    const last = chat.at(-1);
    if (!last || last.who !== "ace" || last.state !== "done" || spoken.current === last.id) return;
    spoken.current = last.id;
    if (!sound) return void store.set({ presence: "idle" });
    store.set({ presence: "speaking" });
    void getVoice()
      .speak(last.text)
      .catch(() => undefined)
      .finally(() => store.set({ presence: wakeMode ? "listening" : "idle" }));
  }, [chat, sound, wakeMode]);

  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    setListening(false);
    if (store.get().presence === "listening") store.set({ presence: "idle" });
  }, []);

  const start = useCallback(
    async (wake: boolean) => {
      setProblem(null);
      getVoice().stopSpeaking();
      try {
        stop.current = await getVoice().listen(async (text) => {
          if (!wake) {
            end();
            return void sendMessage(text);
          }
          const m = wakeMatch(text);
          const addressed =
            m === "yes" ||
            (m === "unclear" &&
              (await api<{ addressed: boolean }>("/wake-check", { method: "POST", body: { transcript: text } }).then(
                (r) => r.addressed,
                () => false,
              )));
          if (addressed) void sendMessage(text);
        });
        setListening(true);
        store.set({ presence: "listening" });
      } catch {
        setProblem("The microphone could not start. Allow microphone access for this site, or type instead.");
        setListening(false);
      }
    },
    [end],
  );

  return {
    listening,
    wakeMode,
    sound,
    problem,
    pushToTalk: () => (listening ? end() : void start(false)),
    toggleWake: () => {
      if (wakeMode) {
        setWakeMode(false);
        end();
      } else {
        setWakeMode(true);
        void start(true);
      }
    },
    toggleSound: () => {
      const next = !sound;
      setSound(next);
      if (!next) getVoice().stopSpeaking();
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* a preference only */
      }
    },
  };
}
