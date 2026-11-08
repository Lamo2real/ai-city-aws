// The + button beside the message box and its drop-up menu, in the style of Claude's own composer: add files
// or photos, add folders, slash commands, connectors and plugins (skills). Each list opens in place with a
// Back row, so it works the same on a phone. The pure parts are in lib/attach.ts.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { allCommands, type Lists } from "../lib/attach.ts";
import { connectorStatus } from "../lib/connect.ts";
import { BackIcon, FilesIcon, FolderIcon, PlugIcon, PlusIcon, PuzzleIcon, SlashIcon } from "./ui.tsx";

type Page = "main" | "slash" | "connectors" | "plugins";
/** How long the closing animation runs (matches .plus-menu.leaving in styles.css). */
const LEAVE_MS = 160;
/** Where inserted words go: before what is typed (a command), after it, or in place of it all. */
export type Insert = { where: "start" | "end" | "all"; select?: [number, number] };

function Item(q: { icon?: ReactNode; label: string; hint?: string; more?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="plus-item" onClick={q.onClick}>
      <span className="plus-ico" aria-hidden>
        {q.icon}
      </span>
      <span className="plus-words">
        {q.label}
        {q.hint ? <span className="hint">{q.hint}</span> : null}
      </span>
      {q.more ? (
        <span className="chev" aria-hidden>
          ›
        </span>
      ) : null}
    </button>
  );
}

export function PlusMenu(p: {
  lists: Lists | null;
  onFiles: (files: File[], fromFolder: boolean) => void;
  onInsert: (text: string, o: Insert) => void;
  go: (view: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Closing plays a short exit (the menu sinks back into the button) before it leaves the page.
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [page, setPage] = useState<Page>("main");
  // The menu is drawn on <body> (a portal) and placed above the button, so the chat panel's own clipping and
  // blur never cut it off; on a phone it may reach over the voice strip. It scrolls when the space is short.
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number; maxHeight: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  useEffect(() => {
    folder.current?.setAttribute("webkitdirectory", "");
  }, []);
  const close = () => {
    if (!open || leaving) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      setPage("main");
    }, LEAVE_MS);
  };
  const openMenu = () => {
    window.clearTimeout(leaveTimer.current);
    setLeaving(false);
    setPage("main");
    setOpen(true);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const showing = open && !leaving;
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = root.current?.querySelector(".plus-btn");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      setPos({
        left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - r.top + 8,
        width,
        maxHeight: Math.min(440, Math.max(160, r.top - 20)),
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
    };
  }, [open]);
  const shown = open && pos !== null; // the menu exists once it has a place
  useEffect(() => {
    if (shown) menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [shown, page]);
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      root.current?.querySelector<HTMLElement>(".plus-btn")?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "ArrowLeft" && page !== "main") {
      e.preventDefault();
      setPage("main");
    }
  };
  const pick = (input: HTMLInputElement | null) => {
    close();
    input?.click();
  };
  const insert = (text: string, o: Insert) => {
    close();
    p.onInsert(text, o);
  };
  const picked = (e: React.ChangeEvent<HTMLInputElement>, fromFolder: boolean) => {
    const list = [...(e.target.files ?? [])];
    e.target.value = "";
    if (list.length) p.onFiles(list, fromFolder);
  };
  const commands = allCommands(p.lists?.skills ?? []);
  const skills = (p.lists?.skills ?? []).filter((s) => s.enabled);
  const connectors = p.lists?.connectors ?? [];
  const back = (title: string) => (
    <>
      <Item icon={<BackIcon />} label="Back" onClick={() => setPage("main")} />
      <p className="plus-head">{title}</p>
    </>
  );

  return (
    <div className="plus" ref={root}>
      <button
        type="button"
        className={`plus-btn${showing ? " on" : ""}`}
        aria-label="Add to your message"
        aria-haspopup="menu"
        aria-expanded={showing}
        onClick={() => (showing ? close() : openMenu())}
      >
        <PlusIcon />
      </button>
      <input
        ref={files}
        type="file"
        multiple
        className="sr"
        tabIndex={-1}
        aria-label="Files to add"
        onChange={(e) => picked(e, false)}
      />
      <input
        ref={folder}
        type="file"
        multiple
        className="sr"
        tabIndex={-1}
        aria-label="A folder to add"
        onChange={(e) => picked(e, true)}
      />
      {open && pos
        ? createPortal(
            <div
              className={`plus-menu${leaving ? " leaving" : ""}`}
              role="menu"
              aria-label="Add to your message"
              ref={menu}
              onKeyDown={onKey}
              style={{ left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
            >
              <div className={`plus-page${page === "main" ? " home" : ""}`} key={page}>
                {page === "main" ? (
                  <>
                    <Item
                      icon={<FilesIcon />}
                      label="Add files or photos"
                      hint="Kept in Knowledge; AIC reads them with your message"
                      onClick={() => pick(files.current)}
                    />
                    <Item
                      icon={<FolderIcon />}
                      label="Add folders"
                      hint="Every file inside, up to 100"
                      onClick={() => pick(folder.current)}
                    />
                    <Item
                      icon={<SlashIcon />}
                      label="Slash commands"
                      hint="Quick things to say"
                      more
                      onClick={() => setPage("slash")}
                    />
                    <Item
                      icon={<PlugIcon />}
                      label="Connectors"
                      hint={connectors.length ? `${connectors.length} connected` : "Outside services AIC can use"}
                      more
                      onClick={() => setPage("connectors")}
                    />
                    <Item
                      icon={<PuzzleIcon />}
                      label="Plugins"
                      hint={skills.length ? `${skills.length} skills` : "Skills your agents follow"}
                      more
                      onClick={() => setPage("plugins")}
                    />
                  </>
                ) : null}
                {page === "slash" ? (
                  <>
                    {back("Slash commands")}
                    {commands.map((c) => (
                      <Item
                        key={c.name}
                        icon={c.skill ? <PuzzleIcon /> : <SlashIcon />}
                        label={`/${c.name}`}
                        hint={c.hint}
                        onClick={() => insert(`/${c.name} `, { where: "start" })}
                      />
                    ))}
                  </>
                ) : null}
                {page === "connectors" ? (
                  <>
                    {back("Connectors")}
                    {connectors.length === 0 ? <p className="plus-none">No connectors yet.</p> : null}
                    {connectors.map((c) => (
                      <Item
                        key={c.id}
                        icon={<PlugIcon />}
                        label={c.label ?? c.id}
                        hint={connectorStatus(c).text}
                        onClick={() => insert(`Use ${c.label ?? c.id} to `, { where: "end" })}
                      />
                    ))}
                    <Item
                      icon={<PlusIcon size={20} />}
                      label="Add a connector…"
                      hint="Name the service; AIC sets it up"
                      onClick={() => insert("Add ___ as a connector", { where: "all", select: [4, 7] })}
                    />
                  </>
                ) : null}
                {page === "plugins" ? (
                  <>
                    {back("Plugins")}
                    {skills.length === 0 ? <p className="plus-none">No plugins yet.</p> : null}
                    {skills.map((s) => (
                      <Item
                        key={s.name}
                        icon={<PuzzleIcon />}
                        label={s.name}
                        hint={s.description || "A skill you added"}
                        onClick={() => insert(`/${s.name} `, { where: "start" })}
                      />
                    ))}
                    <Item
                      icon={<PlusIcon size={20} />}
                      label="Add a plugin…"
                      hint="Opens Skills"
                      onClick={() => {
                        close();
                        p.go("skills");
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
