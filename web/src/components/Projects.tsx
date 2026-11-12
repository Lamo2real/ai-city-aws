// Projects: every app is a project (docs/PRODUCT.md "Projects"). The list is a row of big cards you swipe
// through, "New project" first. A project opens as a studio: a chat with VAIC about this app only, what is
// happening, its versions, and a live preview at phone, tablet, laptop or any size. No code and no jargon:
// one sentence starts a project, and VAIC asks before it guesses.
import { FileCards } from "./FileCards.tsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { CityApp } from "../city/city-state.js";
import { capped, loadApps, removeApp, rollbackApp } from "../lib/apps.ts";
import { ago } from "../lib/format.ts";
import { Markdown } from "../lib/markdown.tsx";
import {
  clampSize,
  DEVICES,
  fitScale,
  loadActivity,
  projectList,
  projects,
  useProjects,
  ZOOMS,
  type Device,
  type Project,
  type TimelineItem,
} from "../lib/projects.ts";
import { useHud } from "../lib/store.ts";
import { building, groupLabel, groupSteps, useBuildSteps, type StepKind } from "../lib/buildSteps.ts";
import { frameSrc, useLiveCopy, type LiveCopy } from "../lib/livePreview.ts";
import { AppFrame, AppIcon, GrantList, PinButton, problem } from "./Apps.tsx";
import { Banner, Button, Confirm, SendIcon, toast } from "./ui.tsx";
import { Select } from "./Select.tsx";

const IDEAS = [
  "A memory game with animal cards for my kids",
  "A tip calculator that splits the bill",
  "A habit tracker with a streak for each day",
  "A quiz about world capitals",
];
const CHANGES = ["Make it easier to read", "Add a dark mode", "Make it work better on my phone"];

/** The `app-new-…` chat an app was built from (set by the server when it publishes). */
const linked = (a: CityApp) => {
  const c = (a as CityApp & { conversation?: unknown }).conversation;
  return typeof c === "string" ? c : "";
};

/** A soft colour pair from the title, so every card looks like its own. */
function hue(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// ---------- the list ----------
export function ProjectsScreen() {
  const apps = useHud((s) => s.city.apps);
  const drafts = useProjects((s) => s.drafts);
  const list = useMemo(() => projectList(apps, drafts), [apps, drafts]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    loadApps().catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    for (const a of Object.values(apps)) if (linked(a)) projects.adopt(a.app_id, linked(a));
  }, [apps]);
  const measure = () => {
    const r = rail.current;
    if (!r) return;
    setEdges({ start: r.scrollLeft <= 4, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 4 });
  };
  useLayoutEffect(measure, [list.length]);
  const page = (dir: 1 | -1) => {
    const r = rail.current;
    if (r) r.scrollBy({ left: dir * Math.max(240, r.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="screen projects" aria-labelledby="projects-title">
      <div className="projects-head">
        <div>
          <h1 id="projects-title">Projects</h1>
          <p className="mute">
            {list.length
              ? "Every app is a project. Open one to try it or change it, or start a new one."
              : "No apps yet. Describe one in a sentence and VAIC builds it with you."}
          </p>
        </div>
        {list.length > 2 ? (
          <div className="rail-arrows">
            <button
              type="button"
              className="rail-arrow"
              aria-label="Earlier projects"
              disabled={edges.start}
              onClick={() => page(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="rail-arrow"
              aria-label="More projects"
              disabled={edges.end}
              onClick={() => page(1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <Banner tone="bad">{`Could not refresh the apps (${error}). Showing what the city last sent.`}</Banner>
      ) : null}
      <ul className="rail" ref={rail} onScroll={measure} aria-label="Your projects">
        <li>
          <button type="button" className="proj-card proj-new" onClick={() => setStarting(true)}>
            <span className="proj-plus" aria-hidden="true">
              +
            </span>
            <b>New project</b>
            <span className="mute">Describe your app in one sentence</span>
          </button>
        </li>
        {list.map((p) => (
          <li key={p.slug}>
            <ProjectCard p={p} />
          </li>
        ))}
      </ul>
      {starting ? <NewProject onClose={() => setStarting(false)} /> : null}
    </section>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const h = hue(p.title);
  const thinking = useProjects((s) => !!s.thinking[p.conversation]);
  const status = !p.app
    ? thinking
      ? "VAIC is on it"
      : "Being planned"
    : p.app.version && p.app.version > 1
      ? `Live · version ${p.app.version}`
      : "Live";
  return (
    <a
      className="proj-card"
      href={`#/apps/${encodeURIComponent(p.slug)}`}
      style={{ "--h": h } as CSSProperties}
      aria-label={`${p.title}, ${status}`}
    >
      <span className="proj-art" aria-hidden="true">
        {p.app ? <AppIcon app={p.app} size={72} /> : <span className="proj-blueprint" />}
      </span>
      <b className="proj-title">{p.title}</b>
      <span className="proj-desc mute">{capped(p.app?.description ?? p.idea ?? "", 110)}</span>
      <span className={`proj-status ${p.app ? "is-live" : "is-planning"}`}>{status}</span>
    </a>
  );
}

function NewProject({ onClose }: { onClose: () => void }) {
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const starting = useRef(false);
  const start = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!idea.trim()) return setError("Write one sentence about your app first.");
    if (starting.current) return; // Enter held down, or pressed twice: one app, not several
    starting.current = true;
    try {
      const p = await projects.start(idea);
      location.hash = `/apps/${p.key}`;
    } catch (err) {
      setError(problem(err));
    } finally {
      starting.current = false;
    }
  };
  return (
    <div className="scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog panel newproj"
        role="dialog"
        aria-modal="true"
        aria-labelledby="newproj-title"
        onSubmit={start}
      >
        <h2 id="newproj-title">What should your app do?</h2>
        <p className="mute">
          One sentence is enough. VAIC asks you a few short questions before it builds, so the app comes out the way you
          picture it.
        </p>
        <label className="sr" htmlFor="newproj-idea">
          Describe your app in one sentence
        </label>
        <textarea
          id="newproj-idea"
          ref={field}
          rows={3}
          maxLength={2000}
          placeholder="Describe your app in one sentence"
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) void start(e);
          }}
        />
        <div className="choices" aria-label="Ideas to start from">
          {IDEAS.map((i) => (
            <button key={i} type="button" className="choice" onClick={() => setIdea(i)}>
              {i}
            </button>
          ))}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row-end">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Start building
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------- one project ----------
type Tab = "chat" | "preview" | "progress" | "versions";
const TABS: Array<{ id: Tab; label: string; phoneOnly?: boolean }> = [
  { id: "chat", label: "Chat" },
  { id: "preview", label: "Preview", phoneOnly: true },
  { id: "progress", label: "What's happening" },
  { id: "versions", label: "Versions" },
];

export function ProjectPage({ slug, go }: { slug: string; go: (view: string) => void }) {
  const apps = useHud((s) => s.city.apps);
  const loaded = useHud((s) => s.loaded);
  const drafts = useProjects((s) => s.drafts);
  const project = useMemo(() => projectList(apps, drafts).find((p) => p.slug === slug) ?? null, [apps, drafts, slug]);
  const [tab, setTab] = useState<Tab>("chat");
  const [playing, setPlaying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!project) loadApps().catch(() => undefined); // maybe published after the last snapshot
  }, [project]);
  // A new project whose app is now published continues on the app's own page.
  const built = slug.startsWith("new-") ? Object.values(apps).find((a) => linked(a) === `app-${slug}`) : undefined;
  useEffect(() => {
    if (!built) return;
    projects.adopt(built.app_id, `app-${slug}`);
    location.replace(`#/apps/${encodeURIComponent(built.slug)}`);
  }, [built, slug]);
  useEffect(() => {
    if (!playing) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [playing]);

  const back = (
    <a className="back" href="#/apps">
      ← Projects
    </a>
  );
  if (!project)
    return (
      <section className="screen" aria-labelledby="app-title">
        {back}
        <h1 id="app-title">{loaded ? "This app is gone" : "Opening the project…"}</h1>
        {loaded ? (
          <p className="empty">It was removed, or the link is wrong. Your other apps are under Projects.</p>
        ) : null}
      </section>
    );
  const app = project.app;
  const title = project.title;

  if (playing && app)
    return (
      <section className="apppage" aria-labelledby="app-title">
        <header className="apphead">
          <button type="button" className="btn btn-quiet back" onClick={() => setPlaying(false)}>
            ← Back to the project
          </button>
          <h1 id="app-title">{title}</h1>
        </header>
        <AppFrame src={app.url} title={`${title} (app built by the city)`} appId={app.app_id} />
      </section>
    );

  return (
    <section className="studio" data-tab={tab} aria-labelledby="app-title">
      <header className="apphead studio-head">
        {back}
        {app ? <AppIcon app={app} size={32} /> : null}
        <h1 id="app-title">{title}</h1>
        {app && (app.version ?? 1) > 1 ? <span className="mute appversion">{`Version ${app.version}`}</span> : null}
        {app ? (
          <>
            <PinButton app={app} />
            <details className="appperms">
              <summary>{`Allowed (${(app.grants ?? []).length})`}</summary>
              <div className="appperms-body">
                <GrantList app={app} />
              </div>
            </details>
            <Button variant="quiet" onClick={() => setRemoving(true)}>
              Remove
            </Button>
            <Button variant="primary" className="openapp" onClick={() => setPlaying(true)}>
              Open the app
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            onClick={() => {
              projects.forget(project.slug);
              go("apps");
            }}
          >
            Remove
          </Button>
        )}
      </header>
      {error ? <Banner tone="bad">{error}</Banner> : null}
      <div className="studio-tabs" role="tablist" aria-label={`${title}: parts`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            className={`studio-tab${t.phoneOnly ? " phone-only" : ""}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="studio-body">
        <div className="studio-side" role="tabpanel" aria-labelledby={`tab-${tab === "preview" ? "chat" : tab}`}>
          {tab === "progress" ? (
            <Timeline project={project} />
          ) : tab === "versions" ? (
            <Versions app={app} onError={setError} />
          ) : (
            <ProjectChat project={project} />
          )}
        </div>
        <Preview
          project={project}
          onShowLog={() => {
            setTab("chat");
            requestAnimationFrame(() => document.getElementById("buildlog")?.scrollIntoView({ block: "end" }));
          }}
        />
      </div>
      {removing && app ? (
        <Confirm
          title={`Remove ${title}?`}
          what="It disappears from Projects and its files are deleted. To get it back, ask VAIC to build it again."
          cost="Nothing to pay; it can't be undone."
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            setRemoving(false);
            setError(null);
            try {
              await removeApp(app.app_id);
              toast({ text: `${title} was removed.`, tone: "good" });
              go("apps");
            } catch (e) {
              setError(problem(e));
            }
          }}
        />
      ) : null}
    </section>
  );
}

function ProjectChat({ project }: { project: Project }) {
  const conv = project.conversation;
  const lines = useProjects((s) => s.chats[conv]);
  const ask = useProjects((s) => s.asks[conv]);
  const thinking = useProjects((s) => !!s.thinking[conv]);
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const chat = lines ?? [];
  const stepCount = useBuildSteps(conv)?.length ?? 0;
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, chat.at(-1)?.text, ask, thinking, stepCount]);
  const send = async (words: string) => {
    try {
      await projects.send(conv, words);
    } catch (e) {
      toast({ text: problem(e), tone: "bad" });
    }
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    void send(t);
  };
  return (
    <div className="pj-chat">
      <div className="pj-log" ref={log} aria-live="polite" aria-label={`Conversation with VAIC about ${project.title}`}>
        {chat.length === 0 ? (
          <div className="pj-hello">
            <p>
              {project.app
                ? `Tell VAIC what to change in ${project.title}. It asks if anything is unclear, then the builders make a new version for you to try.`
                : "Describe your app in one sentence. VAIC asks a few questions, then the builders get to work."}
            </p>
            {project.app ? (
              <div className="choices" aria-label="Changes to start from">
                {CHANGES.map((c) => (
                  <button key={c} type="button" className="choice" onClick={() => void send(c)}>
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {chat.map((l) => (
          <article key={l.id} className={`pj-msg pj-${l.who}`} aria-busy={l.state === "streaming" || undefined}>
            <span className="sr">{l.who === "vaic" ? "VAIC:" : "You:"}</span>
            {l.who === "vaic" ? l.text ? <Markdown text={l.text} /> : null : <p>{l.text}</p>}
            {l.files?.length ? <FileCards files={l.files} label={l.filesLabel} /> : null}
            {l.state === "failed" ? (
              <span className="pj-note">
                Not sent.{" "}
                <button type="button" className="btn btn-quiet" onClick={() => void projects.retry(conv, l.id)}>
                  Send again
                </button>
              </span>
            ) : null}
          </article>
        ))}
        {thinking && chat.at(-1)?.who !== "vaic" ? (
          <article className="pj-msg pj-vaic pj-thinking" aria-label="VAIC is thinking">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </article>
        ) : null}
        <BuildLog conv={conv} />
        {ask ? (
          <div className="pj-ask" role="group" aria-label={ask.question}>
            <p className="pj-ask-q">{ask.question}</p>
            <div className="choices">
              {ask.options.map((o) => (
                <button key={o} type="button" className="choice choice-big" onClick={() => void send(o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <form className="pj-composer" onSubmit={submit}>
        <label className="sr" htmlFor="pj-text">
          {`Message VAIC about ${project.title}`}
        </label>
        <textarea
          id="pj-text"
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={ask ? "Or write your own answer" : project.app ? "What should change?" : "Tell VAIC more"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
        />
        <button type="submit" className="pj-send" aria-label="Send" disabled={!text.trim()}>
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function Timeline({ project }: { project: Project }) {
  const feed = useProjects((s) => s.feed[project.conversation]);
  const chat = useProjects((s) => s.chats[project.conversation]);
  const thinking = useProjects((s) => !!s.thinking[project.conversation]);
  const [server, setServer] = useState<TimelineItem[] | null>(null);
  const appId = project.app?.app_id;
  useEffect(() => {
    if (!appId) return;
    let on = true;
    void loadActivity(appId).then((r) => on && setServer(r));
    return () => {
      on = false;
    };
  }, [appId, feed?.length]);
  // Without the server's timeline: the city events this page saw, what was said here, and the versions.
  const items: TimelineItem[] = useMemo(() => {
    if (server) return [...server].sort((a, b) => b.at.localeCompare(a.at)); // the server sends oldest first
    const out: TimelineItem[] = [...(feed ?? [])];
    for (const l of chat ?? [])
      if (l.state !== "streaming")
        out.push({
          at: new Date(l.at).toISOString(),
          who: l.who === "vaic" ? "VAIC" : "You",
          text: l.who === "vaic" ? `VAIC answered: ${capped(l.text, 90)}` : `You asked: ${capped(l.text, 90)}`,
        });
    const app = project.app;
    if (app?.published_at)
      out.push({ at: app.published_at, who: "VAIC", text: `Version ${app.version ?? 1} went live` });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [server, feed, chat, project.app]);
  return (
    <div className="pj-pane">
      <h2>What's happening</h2>
      {thinking ? (
        <p className="pj-now" role="status">
          <span className="pulse" aria-hidden="true" /> VAIC is working on your last message
        </p>
      ) : null}
      {items.length ? (
        <ol className="timeline">
          {items.slice(0, 30).map((i, n) => (
            <li key={`${i.at}-${n}`}>
              <span className={`tl-who tl-${i.who === "You" ? "you" : i.who === "VAIC" ? "vaic" : "builder"}`}>
                {i.who}
              </span>
              <span className="tl-text">{i.text}</span>
              <time className="mute" dateTime={i.at}>
                {Date.parse(i.at) ? ago(Date.parse(i.at)) : ""}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mute">Nothing yet. When you send VAIC a message, every step shows here in plain words.</p>
      )}
    </div>
  );
}

function Versions({ app, onError }: { app: CityApp | null; onError: (e: string | null) => void }) {
  const [target, setTarget] = useState<number | null>(null); // index into history
  if (!app)
    return (
      <div className="pj-pane">
        <h2>Versions</h2>
        <p className="mute">No versions yet. The first one shows here when it is ready.</p>
      </div>
    );
  const title = capped(app.title, 40);
  const version = app.version ?? 1;
  const history = app.history ?? [];
  const goal = target === null ? null : history[target];
  const goalN = target === null ? 0 : (goal?.version ?? version - target - 1);
  const dropped = target === null ? [] : Array.from({ length: target + 1 }, (_, i) => version - i);
  return (
    <div className="pj-pane">
      <h2>Versions</h2>
      <ol className="versions">
        <li className="is-current">
          <div>
            <b>{`Version ${version}`}</b>
            <span className="mute">{app.published_at ? ` · ${ago(Date.parse(app.published_at))}` : ""}</span>
          </div>
          <span className="proj-status is-live">Live now</span>
        </li>
        {history.map((h, i) => (
          <li key={`${h.version ?? i}`}>
            <div>
              <b>{`Version ${h.version ?? version - i - 1}`}</b>
              <span className="mute">{h.published_at ? ` · ${ago(Date.parse(h.published_at))}` : ""}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => setTarget(i)}
              label={`Go back to version ${h.version ?? version - i - 1}`}
            >
              Go back to this version
            </Button>
          </li>
        ))}
      </ol>
      {!history.length ? (
        <p className="mute">When VAIC makes a change, the earlier version stays here so you can go back.</p>
      ) : null}
      {target !== null ? (
        <Confirm
          title={`Go back to version ${goalN}?`}
          what={`${dropped.length > 1 ? `Versions ${dropped.join(", ")} are` : `Version ${dropped[0]} is`} deleted and ${title} opens as it was before. Its saved data (such as scores) stays.`}
          cost="Nothing to pay. A deleted version can't be brought back, but you can ask VAIC for the change again."
          confirmLabel="Go back"
          onCancel={() => setTarget(null)}
          onConfirm={async () => {
            const steps = target + 1;
            setTarget(null);
            onError(null);
            try {
              // The server goes back one version at a time; each step deletes the version it leaves.
              for (let i = 0; i < steps; i++) await rollbackApp(app.app_id);
              toast({ text: `${title} is back to version ${goalN}.`, tone: "good" });
            } catch (e) {
              onError(problem(e));
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** The frame's address for the live copy, at most about once a second, so a busy builder doesn't make it flicker. */
function useCopySrc(copy: LiveCopy | undefined): string | null {
  const [src, setSrc] = useState(() => (copy ? frameSrc(copy) : null));
  const next = copy ? frameSrc(copy) : null;
  useEffect(() => {
    if (next === src) return;
    if (!src || !next) return setSrc(next);
    const t = setTimeout(() => setSrc(next), 900);
    return () => clearTimeout(t);
  }, [next, src]);
  return src;
}

function Preview({ project, onShowLog }: { project: Project; onShowLog: () => void }) {
  const app = project.app;
  const copy = useLiveCopy(project.conversation);
  const active = useHud((s) => building(s.city, project.conversation));
  // While the builders work (or before the first version), the right side shows their working copy, change by
  // change; once the version is done it shows that version again (decision 278).
  const live = copy && (!app || active) ? copy : undefined;
  const liveSrc = useCopySrc(live);
  const [device, setDevice] = useState<Device>("fill");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [custom, setCustom] = useState({ w: 1024, h: 768 });
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const on = () => setBox({ w: el.clientWidth - 32, h: el.clientHeight - 32 });
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const size = device === "fill" ? null : device === "custom" ? custom : DEVICES[device];
  const scale = size ? (zoom === "fit" ? fitScale(size.w, size.h, box.w, box.h) : zoom) : 1;
  const frame = live ? (
    <AppFrame src={liveSrc ?? frameSrc(live)} title={`${project.title} (being built, live)`} />
  ) : app ? (
    <AppFrame src={app.url} title={`${project.title} (app built by the city)`} appId={app.app_id} />
  ) : null;
  const chips: Array<{ id: Device; label: string }> = [
    { id: "fill", label: "Full size" },
    ...(Object.keys(DEVICES) as Array<keyof typeof DEVICES>).map((k) => ({ id: k, label: DEVICES[k].label })),
    { id: "custom", label: "Custom" },
  ];
  return (
    <div className="studio-preview" aria-label="Preview">
      <div className="pv-bar" hidden={!app && !live}>
        <div className="pv-chips" role="radiogroup" aria-label="Preview size">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={device === c.id}
              className="pv-chip"
              onClick={() => setDevice(c.id)}
            >
              <DeviceGlyph d={c.id} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {device === "custom" ? (
          <div className="pv-custom">
            <label>
              <span className="sr">Width in pixels</span>
              <input
                type="number"
                inputMode="numeric"
                min={240}
                max={3840}
                value={custom.w}
                onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })}
                onBlur={() => setCustom({ ...custom, w: clampSize(custom.w) })}
              />
            </label>
            <span aria-hidden="true">×</span>
            <label>
              <span className="sr">Height in pixels</span>
              <input
                type="number"
                inputMode="numeric"
                min={240}
                max={3840}
                value={custom.h}
                onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })}
                onBlur={() => setCustom({ ...custom, h: clampSize(custom.h) })}
              />
            </label>
          </div>
        ) : null}
        {size ? (
          <label className="pv-zoom">
            <span className="sr">Zoom</span>
            <Select
              value={String(zoom)}
              onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))}
            >
              <option value="fit">{`Fit (${Math.round(scale * 100)}%)`}</option>
              {ZOOMS.map((z) => (
                <option key={z} value={z}>{`${Math.round(z * 100)}%`}</option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {live ? <Editors copy={live} active={active} onShowLog={onShowLog} /> : null}
      <div className={`pv-stage${size ? " is-device" : ""}`} ref={stage} data-device={device}>
        {live ? <LiveLayer copy={live} active={active} /> : null}
        {!app && !live ? (
          <div className="pv-waiting">
            <span className="proj-blueprint big" aria-hidden="true" />
            <p>Your app appears here as soon as its first version is ready.</p>
          </div>
        ) : size ? (
          <div
            className={`pv-device pv-${device}`}
            style={{ width: clampSize(size.w) * scale, height: clampSize(size.h) * scale } as CSSProperties}
            data-width={clampSize(size.w)}
            data-height={clampSize(size.h)}
          >
            <div
              className="pv-scaled"
              style={{ width: clampSize(size.w), height: clampSize(size.h), transform: `scale(${scale})` }}
            >
              {frame}
            </div>
          </div>
        ) : (
          frame
        )}
      </div>
    </div>
  );
}

/** Who is changing what right now, each linked to the build log. */
function Editors({ copy, active, onShowLog }: { copy: LiveCopy; active: boolean; onShowLog: () => void }) {
  const list = Object.values(copy.editors).sort((a, b) => b.at - a.at);
  return (
    <ul className="lv-editors" aria-label="Who is changing the app">
      {list.map((e) => (
        <li key={e.agent} style={{ "--c": e.color } as CSSProperties}>
          <span className="lv-dot" aria-hidden="true" />
          <b>{e.label}</b>
          <span className="mute">{`${active ? "now editing" : "last edited"} app/${e.path}`}</span>
          <button type="button" className="lv-log" onClick={onShowLog} aria-label={`${e.label}: show in the build log`}>
            In the log
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Over the frame: the "Building… live" pill, a corner badge for a change the frame can't point at, and a pulse
 * round the frame each time it reloads. Pointers on elements are drawn inside the frame by its own helper. */
function LiveLayer({ copy, active }: { copy: LiveCopy; active: boolean }) {
  const badges = Object.values(copy.editors).filter((e) => !e.selector);
  return (
    <div className="lv-layer">
      <span className={`lv-pill${active ? " is-on" : ""}`} role="status">
        {active ? (
          <>
            <span className="lv-rec" aria-hidden="true" />
            Building… live
          </>
        ) : (
          "Latest build, not published yet"
        )}
      </span>
      <span key={copy.seq} className="lv-flash" aria-hidden="true" />
      {badges.length ? (
        <div className="lv-badges">
          {badges.map((e) => (
            <span key={e.agent} className="lv-badge" style={{ "--c": e.color } as CSSProperties}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M2 1l11 6-5 1.5L6 14z" fill="currentColor" />
              </svg>
              {`${e.label} · ${e.path}`}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeviceGlyph({ d }: { d: Device }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true,
  } as const;
  if (d === "phone")
    return (
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  if (d === "tablet")
    return (
      <svg {...common}>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  if (d === "laptop")
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="11" rx="1" />
        <path d="M2 19h20" />
      </svg>
    );
  if (d === "custom")
    return (
      <svg {...common}>
        <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

const STEP_ICON: Record<StepKind, string> = {
  command: "M5 7l4 4-4 4M11 16h8",
  github:
    "M6 4v12M18 8v8M6 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 16a2 2 0 1 0 0 4M6 12c6 0 12-1 12-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  read: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  knowledge: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10",
  other: "M5 12h.01M12 12h.01M19 12h.01",
};
function StepIcon({ kind }: { kind: StepKind }) {
  return (
    <svg className="bl-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={STEP_ICON[kind]} />
    </svg>
  );
}

/** The builders' steps under the conversation, the way Claude shows its own: runs of one kind fold into a line
 * ("Ran 3 commands ›") that opens to every step, and a ring with three dots turns while they work (decision 204). */
function BuildLog({ conv }: { conv: string }) {
  const list = useBuildSteps(conv);
  const active = useHud((s) => building(s.city, conv));
  if (!list?.length && !active) return null;
  const groups = groupSteps(list ?? []);
  return (
    <section className="buildlog" id="buildlog" aria-label="What the builders are doing">
      {groups.map((g, i) =>
        g.steps.length === 1 ? (
          <p key={`${g.steps[0]!.at}-${i}`} className="bl-step">
            <StepIcon kind={g.kind} />
            <span>{g.steps[0]!.text}</span>
          </p>
        ) : (
          <details key={`${g.steps[0]!.at}-${i}`} className="bl-group">
            <summary>
              <StepIcon kind={g.kind} />
              <span>{groupLabel(g.kind, g.steps.length)}</span>
              <svg className="bl-chev" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </summary>
            <ol>
              {g.steps.map((s, j) => (
                <li key={`${s.at}-${j}`}>{s.text}</li>
              ))}
            </ol>
          </details>
        ),
      )}
      {active ? (
        <div className="bl-working" role="status">
          <span className="bl-ring" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="sr">The builders are working</span>
        </div>
      ) : null}
    </section>
  );
}
