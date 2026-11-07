// The landing screen: AIC's eye with the voice strip on the left, the conversation on the right (stacked on a
// phone). Everything else can be done by asking AIC ("AIC, pause everything", "what's the status?").
import { ChatCards } from "./ConnectCard.tsx";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage, setPaused } from "../lib/actions.ts";
import { gateStatus } from "../city/city-state.js";
import { store, useHud, waitingCount } from "../lib/store.ts";
import { appendDictation, type SpeakMode } from "../voice/modes.ts";
import { useVoice } from "../voice/useVoice.ts";
import { Eyes } from "./Eyes.tsx";
import { AicStatus, AicSteps } from "./AicStatus.tsx";
import { stepsRunning } from "../lib/steps.ts";
import { StreamedText } from "./StreamedText.tsx";
import { Banner, Button, ClearIcon, Confirm, SendIcon, toast } from "./ui.tsx";
import { VoiceVisualizer } from "./VoiceVisualizer.tsx";

export { MicIcon } from "./ui.tsx";

const DRAFT = "aic.draft";
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT) ?? "";
  } catch {
    return "";
  }
};

export function AceScreen({ go }: { go: (view: string) => void }) {
  const chat = useHud((s) => s.chat);
  const cards = useHud((s) => s.cards);
  const presence = useHud((s) => s.presence);
  const waiting = useHud(waitingCount);
  const live = useHud((s) => s.live);
  const turn = useHud((s) => s.turn);
  const city = useHud((s) => s.city);
  const [confirmStop, setConfirmStop] = useState(false);
  const paused = !!gateStatus(city).paused;
  // Anything still going: open work in the city, or work AIC handed on that has not come back.
  const running = Object.keys(city.tickets ?? {}).length > 0 || chat.some((l) => stepsRunning(l));
  /** Stop (pause) or resume all work: the same route as Settings. */
  const pauseAll = async (stop: boolean) => {
    try {
      await setPaused(stop);
      const c = store.get().city;
      store.set({
        city: { ...c, city: { ...(c.city ?? {}), paused: stop, reason: stop ? "Paused by the owner" : null } },
      });
    } catch {
      toast({ text: stop ? "Could not stop the work. Try again." : "Could not resume. Try again.", tone: "bad" });
    }
  };
  const [text, setText] = useState(readDraft);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  // Dictation writes into the box: `base` is the text before the words being spoken right now.
  const base = useRef(text);
  const typed = useRef(text.trim() !== ""); // the keyboard touched the box since the last send
  const dictated = useRef(false); // dictation added words since the last send
  const voice = useVoice({
    onPartial: (words) => setText(appendDictation(base.current, words)),
    onFinal: (words) => {
      base.current = appendDictation(base.current, words);
      dictated.current = true;
      setText(base.current);
    },
    onStop: () => setText(base.current),
  });

  useEffect(() => input.current?.focus(), []);
  // The message box is one line tall until the text needs more, then grows with it (typed or dictated) up to
  // about eight lines and scrolls inside; it shrinks back as text is deleted or sent.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    const max = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, max)}px`;
    el.style.overflowY = el.scrollHeight + border > max ? "auto" : "hidden";
  }, [text]);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, text); // a draft survives reloads and lost connections
    } catch {
      /* storage blocked: the draft lives as long as the page */
    }
  }, [text]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chat]);
  // While AIC's reply is being revealed, keep it in view unless the owner has scrolled up to read.
  const follow = () => {
    const el = log.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (voice.listening && voice.micMode === "dictate") voice.pushToTalk(); // stop dictating; send what is shown
    // A dictated message counts as voice (AIC may answer aloud) only if the keyboard never touched it.
    const byVoice = dictated.current && !typed.current;
    setText("");
    base.current = "";
    typed.current = false;
    dictated.current = false;
    await sendMessage(t, { voice: byVoice });
    input.current?.focus();
  };
  const lastLine = chat.at(-1);
  // Right after the owner sends, AIC's status row (eye, current step, seconds) shows until its first words.
  const waitingForAic = presence === "thinking" && lastLine?.who === "owner" && lastLine.state !== "failed";

  const shown = presence === "idle" && waiting ? "waiting" : presence;
  const unsent = chat.filter((l) => l.who === "owner" && (l.state === "failed" || l.state === "queued")).length;

  return (
    <section className="ace" aria-labelledby="ace-title">
      <h1 id="ace-title" className="sr">
        Talk to AIC
      </h1>
      <div className="ace-stage">
        <Eyes presence={shown} word={false} />
        <VoiceVisualizer presence={presence} listening={voice.listening} onMic={voice.pushToTalk} />
        <fieldset className="mic-mode">
          <legend className="sr">What the mic does</legend>
          <label className="switch">
            <input
              type="radio"
              name="mic-mode"
              checked={voice.micMode === "send"}
              onChange={() => voice.setMicMode("send")}
            />{" "}
            Talk and send
          </label>
          <label className="switch">
            <input
              type="radio"
              name="mic-mode"
              checked={voice.micMode === "dictate"}
              onChange={() => voice.setMicMode("dictate")}
            />{" "}
            Dictate into the box
          </label>
        </fieldset>
        {voice.problem ? <Banner tone="bad">{voice.problem}</Banner> : null}
        <div className="toggles">
          <label className="switch">
            <input type="checkbox" checked={voice.wakeMode} onChange={voice.toggleWake} /> Hands-free: listen for “hey
            AIC”
          </label>
          <label className="switch speak-mode">
            Speak replies
            <select value={voice.speakMode} onChange={(e) => voice.setSpeakMode(e.target.value as SpeakMode)}>
              <option value="auto">Only when I talk</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </label>
        </div>
      </div>

      <div className="talk" role="region" aria-label="Chat with AIC">
        <header className="talk-head">
          <p className="talk-title">Chat with AIC</p>
          {running && !paused ? (
            <Button variant="danger" className="stop-all" onClick={() => setConfirmStop(true)}>
              Stop all work
            </Button>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={() => store.set({ chat: [] })}
            aria-label="Clear conversation on this device"
            title="Clear conversation on this device"
            disabled={chat.length === 0}
          >
            <ClearIcon />
          </button>
        </header>
        {paused ? (
          <Banner tone="warn" action={{ label: "Resume", onClick: () => void pauseAll(false) }}>
            All work is stopped. Nothing new starts until you resume.
          </Banner>
        ) : null}
        {waiting ? (
          <Banner tone="warn" action={{ label: "Open", onClick: () => go("inbox") }}>
            {waiting === 1 ? "One thing needs you." : `${waiting} things need you.`}
          </Banner>
        ) : null}
        {live === "reconnecting" ? (
          <Banner tone="bad">Connection lost. Your messages are saved. Reconnecting…</Banner>
        ) : null}
        {unsent && live === "online" ? (
          <Banner tone="info">
            {unsent === 1 ? "One message is waiting to send." : `${unsent} messages are waiting to send.`} They go out
            automatically.
          </Banner>
        ) : null}
        <div className="chat" ref={log} aria-live="polite" aria-label="Conversation with AIC">
          {chat.length === 0 ? <p className="hello">Say hi. Try “yo AIC, what’s the status?” or tap the mic.</p> : null}
          {chat.map((l) => (
            <article
              key={l.id}
              className={`msg msg-${l.who} ${l.state === "streaming" ? "is-streaming" : ""}`}
              aria-busy={l.state === "streaming" || undefined}
            >
              <span className="sr">{l.who === "ace" ? "AIC:" : "You:"}</span>
              <div className="msg-body">
                {l.who === "ace" ? (
                  <StreamedText text={l.text} streaming={l.state === "streaming"} onGrow={follow} />
                ) : (
                  <p>{l.text}</p>
                )}
                {l.who === "ace" && l.state === "done" && l.steps ? (
                  <AicSteps steps={l.steps} tookMs={l.tookMs} running={stepsRunning(l)} started={l.started} />
                ) : null}
                {l.state === "failed" || l.state === "queued" ? (
                  <span className="note">Not sent yet. It will send when the connection is back.</span>
                ) : null}
              </div>
            </article>
          ))}
          <ChatCards cards={cards} />
          {waitingForAic && turn ? (
            <article className="msg msg-ace msg-pending">
              <AicStatus turn={turn} />
            </article>
          ) : null}
        </div>
        <form className="composer" onSubmit={submit}>
          <label className="sr" htmlFor="say">
            Message to AIC
          </label>
          <textarea
            id="say"
            ref={input}
            rows={1}
            value={text}
            placeholder={
              voice.listening && voice.micMode === "dictate"
                ? "Listening… your words appear here"
                : "Type your message…"
            }
            onChange={(e) => {
              typed.current = true;
              base.current = e.target.value;
              setText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button type="submit" className="send" aria-label="Send to AIC" disabled={!text.trim()}>
            <SendIcon />
          </button>
        </form>
      </div>
      {confirmStop ? (
        <Confirm
          title="Stop all work?"
          what="Nothing new starts. Work that is already going finishes within a few minutes."
          cost="Stopping costs nothing. You can resume any time."
          confirmLabel="Stop all work"
          danger
          onCancel={() => setConfirmStop(false)}
          onConfirm={async () => {
            setConfirmStop(false);
            await pauseAll(true);
          }}
        />
      ) : null}
    </section>
  );
}
