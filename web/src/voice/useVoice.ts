// Voice for the AIC screen and the City view's big mic button. Typed and spoken turns go into the same chat.
//   voice conversation: the AIC screen's voice button (decision 112). Tap once and it stays on: the mic listens,
//                       what you said is sent when you stop talking, AIC answers aloud, the mic opens again, and
//                       so on until you tap it off (or say "stop listening"). Speech to speech, nothing to type.
//   dictate (the box):  the dictate icon beside Send: the words go into the box (live partials too) until you tap
//                       again; nothing is sent by itself, and the answer to a dictated message is text only.
//   the City's mic:     tap, talk, sent when you stop talking; the answer is spoken unless the City is muted.
// The voice conversation runs on Nova 2 Sonic when it can (decision 120, sonic.ts): real-time, the owner can talk
// over AIC and it stops at once, short spoken cues while AIC works. Sonic is only the voice; every request is
// an ordinary AIC turn. When Sonic cannot start, the step-by-step loop above takes over.
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/actions.ts";
import { store, useHud } from "../lib/store.ts";
import { readSpeakMode, saveSpeakMode, shouldSpeak, type SpeakMode } from "./modes.ts";
import {
  browserSpeak,
  browserStopSpeaking,
  browserVoiceAvailable,
  rememberBrowserVoice,
  usingBrowserVoice,
} from "./browserSpeech.ts";
import { isEcho, isStopPhrase, loopNext } from "./convo.ts";
import { SpeechQueue } from "./speech.ts";
import { loadOpenAi, onVoiceNote, withOpenAi } from "./openai.ts";
import { toast } from "../components/ui.tsx";
import { getVoice, logVoiceError, micProblem, speakProblem } from "./voice.ts";
import { watchForBargeIn } from "./bargeIn.ts";
import { primeSonic, sonicWanted, startSonic, type SonicCall } from "./sonic.ts";

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
// The voice conversation (the AIC screen's voice button): on until the owner taps it off.
const convo = { current: false };
const startRef: { current: ((reopened?: boolean) => void) | null } = { current: null };
// The real-time call while it runs (one for the whole page).
const sonic: { current: SonicCall | null } = { current: null };
/** Loudness of the real-time call, for the visualizer; null when no call runs. */
export const sonicLevels = () => sonic.current?.levels() ?? null;
const lineId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
// Replies already in the chat when the page opens (restored after a reload) are never read aloud again.
const spoken: { current: string | null | undefined } = { current: undefined };

// While AIC talks in a voice conversation, a quiet listener for the owner talking over it (bargeIn.ts).
const barge: { current: (() => void) | null } = { current: null };
function stopBargeIn() {
  barge.current?.();
  barge.current = null;
}

/** Cuts AIC off: drops the reply's queue, stops the clip playing now and any browser voice. */
function stopTalking() {
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

export function useVoice(dictation?: DictationTarget) {
  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState(convo.current);
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
    // In a real-time call Sonic already says the answer: nothing is read aloud a second time.
    if (sonic.current) {
      if (last.state === "done") spoken.current = last.id;
      return;
    }
    // Done talking: with the hands-free loop on after a spoken reply, the mic reopens for the owner's next
    // sentence; otherwise back to idle. In the voice conversation the mic stays open throughout.
    const finish = (t: Talk, spokenAloud: boolean, askedVoice: boolean) => {
      if (t.cancelled || talk.current !== t) return; // cut off: whoever cut it off decides what's next
      stopBargeIn();
      const next = loopNext(loop.current, spokenAloud && askedVoice ? "reply_spoken" : "reply_silent");
      loop.current = next.on;
      // In a voice conversation the mic always opens again after AIC's answer; otherwise the City's loop decides.
      // In a voice conversation the mic never closed: AIC simply goes back to listening.
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
      // In a voice conversation the mic stays open while AIC talks (the owner's wish: always listening); its own
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
            store.set({ presence: "speaking" });
          },
          (e) => {
            t.problem ??= e;
            logVoiceError("the reply could not be spoken", e);
          },
        );
      talk.current = t;
      // Talking over AIC stops it at once and opens the mic (in the voice conversation).
      if (say && convo.current && !dictating.current) {
        stopBargeIn();
        barge.current = watchForBargeIn(() => {
          barge.current = null;
          if (talk.current !== t || t.cancelled || !convo.current) return;
          stopTalking(); // silent at once; the open mic already hears the owner
          if (stop.current) store.set({ presence: "listening" });
          else startRef.current?.(true);
        });
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
    convo.current = false;
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
        stop.current = await getVoice().listen(
          async (text) => {
            if (dictate) return target.current?.onFinal(text);
            if (isStopPhrase(text)) {
              loop.current = false; // "stop listening" ends the conversation and is not sent
              endConversation();
              end();
              return;
            }
            if (convo.current && !dictate) {
              // Always listening: words heard while AIC talks are the owner's, unless they are AIC's own
              // words coming back from the speakers.
              const t = talk.current;
              if (t && !t.cancelled && t.started) {
                const said = store.get().chat.find((l) => l.id === t.id)?.text ?? "";
                if (isEcho(text, said)) return;
              }
              stopTalking();
              return void sendMessage(text, { voice: true });
            }
            end();
            loop.current = loopNext(loop.current, "voice_sent").on; // the loop arms on a spoken send
            return void sendMessage(text, { voice: true });
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
    try {
      const call = await startSonic({
        onUserText: (text) => {
          if (!isStopPhrase(text)) return add("owner", text);
          endConversation(); // "stop listening" ends the call and is not sent
          stopLive();
          setListening(false);
          store.set({ presence: "idle" });
        },
        // AIC's own answer reaches the chat from AIC; only Sonic's small talk (a greeting, "sure") is added here.
        onAssistantText: (text, aic) => !aic && add("ace", text),
        onThinking: (on) => presence(on ? "thinking" : "listening"),
        onSpeaking: (on) => presence(on ? "speaking" : "listening"),
        onEnd: (e) => {
          sonic.current = null;
          if (e && convo.current) {
            // The call broke: say why and carry on with the standard voice instead of going silent.
            logVoiceError("the voice call stopped", e);
            const why = ((e as Error).message ?? "").trim().replace(/\.$/, "").slice(0, 160);
            toast({
              text: `Real-time voice stopped${why ? ` (${why})` : ""}, so AIC is using its standard voice.`,
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
            setProblem(`${(e as Error).message || "AIC's voice stopped."} Tap the voice button to talk again.`);
          }
        },
      });
      if (!convo.current) return call.stop(); // tapped off while it was connecting
      sonic.current = call;
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
      const why = ((e as Error | null)?.message ?? "").trim().replace(/\.$/, "").slice(0, 160);
      toast({
        text: `Real-time voice didn't connect${why ? ` (${why})` : ""}, so AIC is using its standard voice.`,
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
    /** The voice conversation is on (the AIC screen's voice button). */
    conversation,
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
    /** The AIC screen's voice button: a speech-to-speech conversation, on until tapped off. */
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
      if (sonicWanted()) {
        primeSonic(); // synchronously, inside the tap (Safari)
        return void startLive();
      }
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
