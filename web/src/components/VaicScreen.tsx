// The landing screen: VAIC's eye with the voice strip on the left, the conversation on the right (stacked on a
// phone). Everything else can be done by asking VAIC ("send the workers home", "what's the status?").
import { ChatCards } from "./ConnectCard.tsx";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { keyBlocked, sendMessage, stopReply } from "../lib/actions.ts";
import { knowledgeApi } from "../lib/api.ts";
import {
  allCommands,
  ONLY_FILES,
  attachedLine,
  bubbleText,
  isImageItem,
  sentAttachments,
  expandSlash,
  folderFiles,
  loadLists,
  matchCommands,
  sendable,
  type Lists,
} from "../lib/attach.ts";
import { MAX_CHAT_IMAGES, addFiles, capImages, isImageType, useKnowledge } from "../lib/knowledge.ts";
import { placeCards, store, useHud } from "../lib/store.ts";
import { awayStart, cameBack } from "../lib/away.ts";
import { AwayPanel } from "./Away.tsx";
import { appendDictation } from "../voice/modes.ts";
import { useVoice } from "../voice/useVoice.ts";
import { VaicStatus, VaicSteps } from "./VaicStatus.tsx";
import { stepsRunning } from "../lib/steps.ts";
import { statusWords } from "./Knowledge.tsx";
import { ComposerAttachment, SentAttachments } from "./ChatAttachments.tsx";
import { forgetLocal, keepLocal } from "../lib/chatImages.ts";
import { PlusMenu, type Insert } from "./PlusMenu.tsx";
import { StreamedText } from "./StreamedText.tsx";
import { FileCards } from "./FileCards.tsx";
import { Banner, ClearIcon, ClockIcon, MicIcon, SendIcon, StopIcon, toast, WaveIcon } from "./ui.tsx";
import { MicWave, VoiceVisualizer } from "./VoiceVisualizer.tsx";
import { WorkflowCard } from "./WorkflowCard.tsx";
import { SkillPanel, useShownDraft, useWide } from "./SkillDraft.tsx";
import { workflows } from "../lib/workflows.ts";

export { MicIcon } from "./ui.tsx";

const DRAFT = "vaic.draft";
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT) ?? "";
  } catch {
    return "";
  }
};

export function VaicScreen({ go }: { go: (view: string) => void }) {
  const chat = useHud((s) => s.chat);
  const cards = useHud((s) => s.cards);
  const placed = placeCards(chat, cards);
  // A skill VAIC wrote: beside the chat on a wide screen, a sheet on the phone (decision 257).
  const skillDraft = useShownDraft();
  const wide = useWide();
  const presence = useHud((s) => s.presence);
  // "While you were away": opens by itself after more than 12 hours away, and from the clock any time.
  const [away, setAway] = useState<number | null>(() => (cameBack() ? awayStart() : null));
  const [noSummary, setNoSummary] = useState(false);
  const live = useHud((s) => s.live);
  const turn = useHud((s) => s.turn);
  const [text, setText] = useState(readDraft);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  // Dictation writes into the box: `base` is the text before the words being spoken right now, `pending` those
  // words while the recognizer may still change them. Stop keeps everything shown, pending words included, to edit,
  // send with Enter or add to by dictating again; the recognizer's last word may land just after stop and then
  // replaces the pending words it finishes (`closing`), until the owner types.
  const base = useRef(text);
  const pending = useRef("");
  const closing = useRef(false);
  const voice = useVoice({
    onPartial: (words) => {
      if (closing.current) return;
      pending.current = words;
      setText(appendDictation(base.current, words));
    },
    onFinal: (words) => {
      if (closing.current && !pending.current) return;
      base.current = appendDictation(base.current, words);
      pending.current = "";
      setText(base.current);
    },
    onStop: () => {
      closing.current = true;
      setText(appendDictation(base.current, pending.current));
      requestAnimationFrame(() => input.current?.focus());
    },
  });
  // The + menu: skills and connectors to list, and the files attached to the message being written (they are
  // knowledge items, so their live status comes from the knowledge store).
  const [lists, setLists] = useState<Lists | null>(null);
  const [attached, setAttached] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const kn = useKnowledge((s) => s);
  const items = attached.flatMap((id) => kn.items.filter((x) => x.id === id));
  useEffect(() => {
    void loadLists().then(setLists);
  }, []);
  // Workflow runs: on open and after a reconnect (events may have been missed).
  const online = live === "online";
  useEffect(() => {
    void workflows.load();
  }, [online]);
  const commands = allCommands(lists?.skills ?? []);
  const suggestions = matchCommands(text, commands);

  const [tall, setTall] = useState(false);
  useEffect(() => input.current?.focus(), []);
  // The message box is one line tall until the text needs more, then grows with it (typed or dictated) up to
  // about eight lines and scrolls inside; it shrinks back as text is deleted or sent.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const max = parseFloat(cs.maxHeight) || Infinity;
    const border = el.offsetHeight - el.clientHeight;
    const lineH = parseFloat(cs.lineHeight) || 23;
    const oneLine = lineH + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (text === "") {
      // Empty: one line, never the height of a placeholder that wraps on a narrow phone (decision 210).
      el.style.height = `${oneLine + border}px`;
      el.style.overflowY = "hidden";
      setTall(false);
      return;
    }
    el.style.height = `${Math.min(el.scrollHeight + border, max)}px`;
    el.style.overflowY = el.scrollHeight + border > max ? "auto" : "hidden";
    // Like ChatGPT's box: the words use the whole width first; once they need a second line, the text takes the
    // full top row and the buttons move under it, and it stays that way until the box is empty again.
    const wraps = el.scrollHeight > oneLine * 1.4;
    setTall((was) => was || wraps);
  }, [text]);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, text); // a draft survives reloads and lost connections
    } catch {
      /* storage blocked: the draft lives as long as the page */
    }
  }, [text]);
  // The chat stays pinned to the newest line while anything below grows (VAIC's reply being revealed, its steps,
  // a Yes/No card), unless the owner scrolled up to read. A new message from the owner or a new reply from VAIC
  // always brings the chat down to it (the owner, 2026-11-11: "I'm not left above where there is more messages").
  const stick = useRef(true);
  const lastVaic = chat.filter((l) => l.who === "vaic").length;
  const lastOwner = chat.filter((l) => l.who === "owner").length;
  useEffect(() => {
    stick.current = true;
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lastVaic, lastOwner]);
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    const keep = () => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const mo = new MutationObserver(keep);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(keep);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      mo.disconnect();
      ro.disconnect();
    };
  }, []);
  const follow = () => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  };

  // The box before dictation started, so × puts it back exactly as it was.
  const beforeDictation = useRef("");
  const startDictation = () => {
    beforeDictation.current = text;
    base.current = text; // new words go after what the box shows, typed or dictated before
    pending.current = "";
    closing.current = false;
    voice.toggleDictate();
  };
  const cancelDictation = () => {
    voice.toggleDictate();
    closing.current = true;
    pending.current = "";
    base.current = beforeDictation.current;
    setText(beforeDictation.current); // a word landing after this is ignored (`closing`)
    input.current?.focus();
  };
  const setTyped = (next: string) => {
    if (!voice.dictating) closing.current = true; // typed after stop: a late word must not undo the typing
    pending.current = "";
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
    const capped = capImages(files, items.filter((x) => isImageType(x.content_type)).length);
    files = capped.files;
    if (capped.left)
      toast({
        tone: "info",
        text: `Up to ${MAX_CHAT_IMAGES} images per message: ${capped.left} ${capped.left === 1 ? "image was" : "images were"} left out.`,
      });
    if (!files.length) return;
    const problems = await addFiles(files, {
      onFile: (item, file) => keepLocal(item.id, file), // the thumbnail shows at once, before the upload ends
      onCreated: (item) => setAttached((a) => [...a, item.id]),
    });
    for (const p of problems) toast({ tone: "bad", text: p });
    input.current?.focus();
  };
  const unattach = (id: string) => {
    setAttached((a) => a.filter((x) => x !== id));
    forgetLocal(id);
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
    let body = slash?.kind === "send" ? slash.text : t;
    // Only the owner's words are checked for a pasted key: a photo named like "A9A8BF3C-3DE2-….jpeg" is not one.
    if (keyBlocked(body)) return; // not sent: what was typed and attached stays in the box
    if (items.length) body = `${body || ONLY_FILES}\n\n${attachedLine(items)}`;
    setText("");
    base.current = "";
    pending.current = ""; // the dictated words were just sent: a late update must not put them back in the box
    setAttached([]);
    // Typed or dictated, the message is text and VAIC answers in text; the voice button is for talking.
    await sendMessage(body, items.length ? { attachments: sentAttachments(items) } : {});
    input.current?.focus();
  };
  // While VAIC thinks or writes its answer, Send becomes Stop (like ChatGPT and Claude); Esc stops too.
  const busy = turn ? store.busyLine() : undefined;
  const stop = () => {
    if (!stopReply()) return;
    voice.stopSpeaking();
    input.current?.focus();
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const busyNow = !!busy;
  useEffect(() => {
    if (!busyNow) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Esc first closes whatever is open (a menu, a dialog, the slash list); only then does it stop VAIC.
      if (document.querySelector("[role=dialog], [role=menu], .slash-pop, .plus-pop")) return;
      e.preventDefault();
      stopRef.current();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busyNow]);
  /** "Edit": the stopped message comes back into the box to change and send again. */
  const editStopped = (id: string, words: string, files?: { id: string }[]) => {
    store.removeLine(id);
    setTyped(words);
    if (files?.length) setAttached(files.map((f) => f.id)); // the attachments come back with the words
    input.current?.focus();
    pendingSelection.current = [words.length, words.length];
  };
  const lastLine = chat.at(-1);
  // Right after the owner sends, VAIC's status row (eye, current step, seconds) shows until its first words.
  const waitingForVaic = presence === "thinking" && lastLine?.who === "owner" && lastLine.state !== "failed";

  // A message on its way is not a problem: only one that failed, or that waits while the connection is down, is
  // shown as unsent (the owner, 2026-11-11: no warning flashing on every send).
  const unsent = chat.filter((l) => l.who === "owner" && l.state === "failed").length;

  return (
    <section
      className={`vaic${voice.conversation ? " voice-live" : ""}${skillDraft && wide ? " has-skill" : ""}`}
      aria-labelledby="vaic-title"
    >
      <h1 id="vaic-title" className="sr">
        Talk to VAIC
      </h1>
      <div
        className={`talk${dragging ? " is-dropping" : ""}`}
        role="region"
        aria-label="Chat with VAIC"
        // Drag and drop images (up to 10 per message) or any other files onto the chat (decision 214).
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          const dropped = [...e.dataTransfer.files];
          if (dropped.length) void onFiles(dropped, false);
        }}
      >
        {dragging ? (
          <div className="drop-hint" aria-hidden="true">
            <span>Drop to attach · up to {MAX_CHAT_IMAGES} images</span>
          </div>
        ) : null}
        {/* No header: the panel runs up behind the top bar (decision 108); the clear button floats in its corner. */}
        {chat.length ? (
          <button
            type="button"
            className="icon-btn talk-clear"
            onClick={() => store.set({ chat: [] })}
            aria-label="Clear conversation on this device"
            title="Clear conversation on this device"
          >
            <ClearIcon />
          </button>
        ) : null}
        {noSummary ? null : (
          <button
            type="button"
            className="icon-btn talk-away"
            onClick={() =>
              setAway((a) => (a === null ? Math.min(awayStart() ?? Infinity, Date.now() - 24 * 3600_000) : null))
            }
            aria-expanded={away !== null}
            aria-label="While you were away"
            title="While you were away"
          >
            <ClockIcon />
          </button>
        )}
        <div className="talk-notes">
          {voice.problem ? <Banner tone="bad">{voice.problem}</Banner> : null}
          {away !== null ? (
            <AwayPanel
              since={away}
              onClose={() => setAway(null)}
              onMissing={() => (setNoSummary(true), setAway(null))}
            />
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
        </div>
        <div className="chat" ref={log} aria-live="polite" aria-label="Conversation with VAIC" tabIndex={0}>
          {chat.length === 0 ? <p className="hello">Say hi. Type, or tap the voice button and just talk.</p> : null}
          {chat.map((l, i) => (
            <Fragment key={l.id}>
              {placed.before.has(i) ? <ChatCards cards={placed.before.get(i) ?? []} /> : null}
              <article
                className={`msg msg-${l.who} ${l.state === "streaming" ? "is-streaming" : ""}`}
                aria-busy={l.state === "streaming" || undefined}
              >
                <span className="sr">{l.who === "vaic" ? "VAIC:" : "You:"}</span>
                <div className="msg-body">
                  {l.who === "vaic" ? (
                    l.text || l.state === "streaming" ? (
                      <StreamedText text={l.text} streaming={l.state === "streaming"} onGrow={follow} />
                    ) : null
                  ) : (
                    <>
                      {l.attachments?.length ? <SentAttachments attachments={l.attachments} /> : null}
                      {bubbleText(l.text, l.attachments) ? <p>{bubbleText(l.text, l.attachments)}</p> : null}
                    </>
                  )}
                  {l.files?.length ? <FileCards files={l.files} label={l.filesLabel} /> : null}
                  {l.who === "vaic" && l.state === "done" && l.steps ? (
                    <VaicSteps steps={l.steps} tookMs={l.tookMs} running={stepsRunning(l)} started={l.started} />
                  ) : null}
                  {l.who === "owner" && l.stopped ? (
                    <span className="note is-stopped">
                      Stopped.
                      {l.stoppedSteps?.length ? ` VAIC had already done: ${l.stoppedSteps.join(", ")}.` : ""}
                      {l.handedOn ? " Work it handed to the team keeps going; stop that job in Jobs." : ""}{" "}
                      <button type="button" className="linkish" onClick={() => editStopped(l.id, bubbleText(l.text, l.attachments), l.attachments)}>
                        Edit and send again
                      </button>
                    </span>
                  ) : l.state === "failed" || (l.state === "queued" && live !== "online") ? (
                    <span className="note">Not sent yet. It will send when the connection is back.</span>
                  ) : null}
                </div>
              </article>
            </Fragment>
          ))}
          <ChatCards cards={placed.end} />
          <WorkflowCard />
          {waitingForVaic && turn ? (
            <article className="msg msg-vaic msg-pending">
              <VaicStatus turn={turn} />
            </article>
          ) : null}
        </div>
        {voice.conversation || (voice.listening && !voice.dictating) ? (
          // While the voice conversation is on (or dictation listens): who is talking, as the moving line.
          <VoiceVisualizer
            presence={presence}
            listening={voice.listening}
            onMic={voice.pushToTalk}
            bare
            engine={voice.engine}
          />
        ) : null}
        <form className={`composer${voice.dictating ? " is-dictating" : ""}`} onSubmit={submit}>
          {items.length ? (
            <ul className="attached" aria-label="Attached to your message">
              {items.map((i) => (
                <ComposerAttachment
                  key={i.id}
                  item={i}
                  image={isImageItem(i)}
                  percent={kn.progress[i.id]}
                  status={statusWords(i, kn.progress[i.id], kn.localError[i.id])}
                  failed={!!kn.localError[i.id] || i.status === "failed"}
                  onRemove={() => unattach(i.id)}
                />
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
          <div className={`cbox${tall ? " is-tall" : ""}`}>
            {voice.dictating ? null : (
              <PlusMenu lists={lists} onFiles={(f, folder) => void onFiles(f, folder)} onInsert={insert} go={go} />
            )}
            <label className="sr" htmlFor="say">
              Message to VAIC
            </label>
            <textarea
              id="say"
              ref={input}
              rows={1}
              value={text}
              placeholder={voice.dictating ? "Listening… your words appear here" : "Ask VAIC…"}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            {voice.dictating ? (
              // Dictating, like Claude's composer: the words stream into the box above; here a cancel, the live
              // sound of your voice, stop (keep the words to edit) and send at once.
              <div className="dictation-bar" role="group" aria-label="Dictation">
                <button
                  type="button"
                  className="dict-cancel"
                  onClick={cancelDictation}
                  aria-label="Cancel dictation"
                  title="Cancel dictation"
                >
                  ×
                </button>
                <MicWave />
                <button
                  type="button"
                  className="dict-stop"
                  onClick={voice.toggleDictate}
                  aria-label="Stop dictating"
                  title="Stop dictating (keep the words)"
                >
                  <span aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="send dict-send"
                  onClick={() => void submit()}
                  aria-label="Send to VAIC"
                  disabled={!text.trim() && !items.length}
                >
                  <SendIcon />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={`dictate ${voice.dictating ? "on" : ""}`}
                  onClick={startDictation}
                  aria-pressed={voice.dictating}
                  aria-label={voice.dictating ? "Stop dictating" : "Dictate into the box"}
                  title={voice.dictating ? "Stop dictating" : "Dictate into the box"}
                >
                  <MicIcon />
                </button>
                <button
                  type="button"
                  className={`voice-btn ${voice.conversation ? "on" : ""}`}
                  onClick={voice.toggleConversation}
                  aria-pressed={voice.conversation}
                  aria-label={voice.conversation ? "End the voice conversation" : "Talk to VAIC"}
                  title={voice.conversation ? "End the voice conversation" : "Talk to VAIC: speak, VAIC answers aloud"}
                >
                  <WaveIcon />
                </button>
                {busy ? (
                  <button
                    type="button"
                    className="send stop"
                    onClick={stop}
                    aria-label="Stop VAIC's answer"
                    title="Stop (Esc)"
                  >
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="send"
                    aria-label="Send to VAIC"
                    disabled={(!text.trim() && !items.length) || !sendable(items)}
                  >
                    <SendIcon size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
      {skillDraft ? <SkillPanel d={skillDraft} sheet={!wide} /> : null}
    </section>
  );
}
