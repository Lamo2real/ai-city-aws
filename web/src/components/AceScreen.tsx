// The landing screen: AIC's eye with the voice strip on the left, the conversation on the right (stacked on a
// phone). Everything else can be done by asking AIC ("AIC, pause everything", "what's the status?").
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage } from "../lib/actions.ts";
import { Markdown } from "../lib/markdown.tsx";
import { store, useHud, waitingCount } from "../lib/store.ts";
import { useVoice } from "../voice/useVoice.ts";
import { Eyes } from "./Eyes.tsx";
import { Banner, ClearIcon, SendIcon } from "./ui.tsx";
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
  const presence = useHud((s) => s.presence);
  const waiting = useHud(waitingCount);
  const live = useHud((s) => s.live);
  const [text, setText] = useState(readDraft);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const voice = useVoice();

  useEffect(() => input.current?.focus(), []);
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

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendMessage(t);
    input.current?.focus();
  };
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
        {voice.problem ? <Banner tone="bad">{voice.problem}</Banner> : null}
        <div className="toggles">
          <label className="switch">
            <input type="checkbox" checked={voice.wakeMode} onChange={voice.toggleWake} /> Hands-free: listen for “hey
            AIC”
          </label>
          <label className="switch">
            <input type="checkbox" checked={voice.sound} onChange={voice.toggleSound} /> Speak replies
          </label>
        </div>
      </div>

      <div className="talk" role="region" aria-label="Chat with AIC">
        <header className="talk-head">
          <p className="talk-title">Chat with AIC</p>
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
            <article key={l.id} className={`msg msg-${l.who}`}>
              <span className="sr">{l.who === "ace" ? "AIC:" : "You:"}</span>
              <div className="msg-body">
                {l.who === "ace" ? <Markdown text={l.text} /> : <p>{l.text}</p>}
                {l.state === "failed" || l.state === "queued" ? (
                  <span className="note">Not sent yet. It will send when the connection is back.</span>
                ) : null}
                {l.state === "streaming" ? (
                  <span className="typing" aria-label="AIC is still writing">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={submit}>
          <label className="sr" htmlFor="say">
            Message to AIC
          </label>
          <textarea
            id="say"
            ref={input}
            rows={2}
            value={text}
            placeholder="Type your message…"
            onChange={(e) => setText(e.target.value)}
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
    </section>
  );
}
