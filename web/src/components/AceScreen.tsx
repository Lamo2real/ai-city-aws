// The landing screen: AIC's eye with the voice strip on the left, the conversation on the right (stacked on a
// phone). Everything else can be done by asking AIC ("send the workers home", "what's the status?").
import { ChatCards } from "./ConnectCard.tsx";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage } from "../lib/actions.ts";
import { knowledgeApi } from "../lib/api.ts";
import {
  allCommands,
  attachedLine,
  expandSlash,
  folderFiles,
  loadLists,
  matchCommands,
  sendable,
  type Lists,
} from "../lib/attach.ts";
import { addFiles, useKnowledge } from "../lib/knowledge.ts";
import { store, useHud, waitingCount } from "../lib/store.ts";
import { needsWords } from "../lib/needs.ts";
import { appendDictation, type SpeakMode } from "../voice/modes.ts";
import { useVoice } from "../voice/useVoice.ts";
import { Eyes } from "./Eyes.tsx";
import { AicStatus, AicSteps } from "./AicStatus.tsx";
import { stepsRunning } from "../lib/steps.ts";
import { statusWords } from "./Knowledge.tsx";
import { PlusMenu, type Insert } from "./PlusMenu.tsx";
import { StreamedText } from "./StreamedText.tsx";
import { Banner, ClearIcon, DictateIcon, SendIcon, toast } from "./ui.tsx";
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
  // The + menu: skills and connectors to list, and the files attached to the message being written (they are
  // knowledge items, so their live status comes from the knowledge store).
  const [lists, setLists] = useState<Lists | null>(null);
  const [attached, setAttached] = useState<string[]>([]);
  const kn = useKnowledge((s) => s);
  const items = attached.flatMap((id) => kn.items.filter((x) => x.id === id));
  useEffect(() => {
    void loadLists().then(setLists);
  }, []);
  const commands = allCommands(lists?.skills ?? []);
  const suggestions = matchCommands(text, commands);

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

  const setTyped = (next: string) => {
    typed.current = true;
    base.current = next;
    setText(next);
  };
  /** Words from the + menu: a command goes in front (replacing one already there), the rest at the end. */
  const insert = (words: string, o: Insert) => {
    const next =
      o.where === "all"
        ? words
        : o.where === "start"
          ? words + text.replace(/^\/\S*\s?/, "")
          : (text ? text.replace(/\s*$/, " ") : "") + words;
    setTyped(next);
    input.current?.focus(); // now, before the menu unmounts and would drop the focus on the page
    pendingSelection.current = o.select ?? [next.length, next.length];
  };
  const pendingSelection = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    if (!sel || !input.current) return;
    pendingSelection.current = null;
    input.current.setSelectionRange(sel[0], sel[1]);
  }, [text]);
  /** Files or a folder from the + menu: uploaded to the knowledge base, each one a chip under the box. */
  const onFiles = async (picked: File[], fromFolder: boolean) => {
    let files = picked;
    if (fromFolder) {
      const r = folderFiles(picked);
      files = r.files;
      const notes = [
        r.hidden ? `${r.hidden} hidden ${r.hidden === 1 ? "file was" : "files were"} left out` : "",
        r.skipped ? `only the first ${files.length} files were added` : "",
      ].filter(Boolean);
      if (notes.length) toast({ tone: "info", text: `${notes.join("; ")}.` });
    }
    if (!files.length) return;
    const problems = await addFiles(files, { onCreated: (item) => setAttached((a) => [...a, item.id]) });
    for (const p of problems) toast({ tone: "bad", text: p });
    input.current?.focus();
  };
  const unattach = (id: string) => {
    setAttached((a) => a.filter((x) => x !== id));
    knowledgeApi.remove(id).catch(() => undefined); // it was added for this message only
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t && !items.length) return;
    if (!sendable(items)) {
      toast({ tone: "info", text: "Your files are still uploading. Send once they are in." });
      return;
    }
    const slash = expandSlash(t, commands);
    if (slash?.kind === "clear") {
      store.set({ chat: [] });
      setTyped("");
      return;
    }
    if (slash?.kind === "needs") {
      const c = slash.command;
      const example = c.name === "connect" ? "HeyGen" : "what you want done";
      toast({ tone: "info", text: `Add the ${c.arg} after /${c.name}, like “/${c.name} ${example}”.` });
      return;
    }
    if (voice.dictating) voice.toggleDictate(); // stop dictating; send what is shown
    // A dictated message counts as voice (AIC may answer aloud) only if the keyboard never touched it.
    const byVoice = dictated.current && !typed.current && !items.length;
    let body = slash?.kind === "send" ? slash.text : t;
    if (items.length) body = `${body || "Take a look at what I attached."}\n\n${attachedLine(items)}`;
    setText("");
    base.current = "";
    typed.current = false;
    dictated.current = false;
    setAttached([]);
    await sendMessage(body, { voice: byVoice });
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
        {voice.problem ? <Banner tone="bad">{voice.problem}</Banner> : null}
        <div className="toggles">
          <label className="switch">
            <input type="checkbox" checked={voice.wakeMode} onChange={voice.toggleWake} /> Hands-free: listen for “hey
            AIC” (say “hey Ace”)
          </label>
          <fieldset className="speak-mode">
            <legend>Speak replies</legend>
            {/* The amber pill slides to the chosen option (`--i` is its index; see .seg::before). */}
            <div
              className="seg"
              style={{ "--i": ["auto", "always", "never"].indexOf(voice.speakMode) } as React.CSSProperties}
            >
              {(
                [
                  ["auto", "When I talk"],
                  ["always", "Always"],
                  ["never", "Never"],
                ] as Array<[SpeakMode, string]>
              ).map(([m, label]) => (
                <label key={m} className={voice.speakMode === m ? "on" : ""}>
                  <input
                    type="radio"
                    name="speak-mode"
                    value={m}
                    checked={voice.speakMode === m}
                    onChange={() => voice.setSpeakMode(m)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
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
            {`${needsWords(waiting)}.`}
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
          {items.length ? (
            <ul className="attached" aria-label="Attached to your message">
              {items.map((i) => (
                <li key={i.id} className={`chip chip-${kn.localError[i.id] ? "failed" : i.status}`}>
                  <span className="chip-name">{i.title}</span>
                  <span className="st" role="status">
                    {statusWords(i, kn.progress[i.id], kn.localError[i.id])}
                  </span>
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove ${i.title}`}
                    title="Remove"
                    onClick={() => unattach(i.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {suggestions.length ? (
            <ul className="slash-pop" aria-label="Slash commands">
              {suggestions.slice(0, 8).map((c) => (
                <li key={c.name}>
                  <button type="button" className="plus-item" onClick={() => insert(`/${c.name} `, { where: "start" })}>
                    <span className="plus-ico" aria-hidden>
                      /
                    </span>
                    <span className="plus-words">
                      {`/${c.name}`}
                      <span className="hint">{c.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <PlusMenu lists={lists} onFiles={(f, folder) => void onFiles(f, folder)} onInsert={insert} go={go} />
          <label className="sr" htmlFor="say">
            Message to AIC
          </label>
          <textarea
            id="say"
            ref={input}
            rows={1}
            value={text}
            placeholder={voice.dictating ? "Listening… your words appear here" : "Type your message…"}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            type="button"
            className={`dictate ${voice.dictating ? "on" : ""}`}
            onClick={voice.toggleDictate}
            aria-pressed={voice.dictating}
            aria-label={voice.dictating ? "Stop dictating" : "Dictate into the box"}
            title={voice.dictating ? "Stop dictating" : "Dictate into the box"}
          >
            <DictateIcon />
          </button>
          <button
            type="submit"
            className="send"
            aria-label="Send to AIC"
            disabled={(!text.trim() && !items.length) || !sendable(items)}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </section>
  );
}
