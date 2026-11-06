// The landing screen: Ace, with the input focused and the mic in reach. Everything else can be done
// by asking Ace ("Ace, pause everything", "what's the status of the product?").
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage } from "../lib/actions.ts";
import { store, useHud, waitingCount } from "../lib/store.ts";
import { useVoice } from "../voice/useVoice.ts";
import { Eyes } from "./Eyes.tsx";
import { Banner, Button } from "./ui.tsx";

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
        Talk to Ace
      </h1>
      <Eyes presence={shown} />
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
      <div className="chat" ref={log} aria-live="polite" aria-label="Conversation with Ace">
        {chat.length === 0 ? (
          <p className="mute hello">Say hi — try “yo Ace, what’s the status?” or tap the mic.</p>
        ) : null}
        {chat.map((l) => (
          <div key={l.id} className={`line line-${l.who}`}>
            <span className="who">{l.who === "ace" ? "Ace" : "You"}</span>
            <p>{l.text}</p>
            {l.state === "failed" || l.state === "queued" ? (
              <span className="note">Not sent yet — it will send when the connection is back.</span>
            ) : null}
            {l.state === "streaming" ? <span className="note">…</span> : null}
          </div>
        ))}
      </div>
      {voice.problem ? <Banner tone="bad">{voice.problem}</Banner> : null}
      <form className="composer" onSubmit={submit}>
        <button
          type="button"
          className={`mic ${voice.listening ? "on" : ""}`}
          onClick={voice.pushToTalk}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Stop listening" : "Talk to Ace"}
        >
          <MicIcon />
          <span>{voice.listening ? "Listening… tap to stop" : "Talk"}</span>
        </button>
        <label className="sr" htmlFor="say">
          Message to Ace
        </label>
        <textarea
          id="say"
          ref={input}
          rows={2}
          value={text}
          placeholder="Ask Ace anything…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button variant="primary" type="submit" label="Send to Ace" disabled={!text.trim()}>
          Send
        </Button>
      </form>
      <div className="toggles">
        <label className="switch">
          <input type="checkbox" checked={voice.wakeMode} onChange={voice.toggleWake} /> Hands-free: listen for “hey
          Ace”
        </label>
        <label className="switch">
          <input type="checkbox" checked={voice.sound} onChange={voice.toggleSound} /> Speak replies
        </label>
        <button type="button" className="link" onClick={() => store.set({ chat: [] })}>
          Clear conversation on this device
        </button>
      </div>
    </section>
  );
}

export function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
