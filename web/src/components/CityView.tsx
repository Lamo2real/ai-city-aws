// The City view: the ported pixel-art scene on a canvas, with the Mac HUD's layout around it —
// status bar on top, departments / records / activity on the right, zoom and actions at the bottom.
// Driven entirely by WebSocket events through the store.
import { CityTabs } from "./Features.tsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  MODEL_NAME,
  VISUALS,
  standingDepartments,
  plainText,
  stockholmTime,
  stories,
  ticketWords,
  topBar,
  visualState,
  type CityState,
} from "../city/city-state.js";
import { mountCity, type CityScene } from "../city/scene.js";
import { instruct, sendWorkerHome } from "../lib/actions.ts";
import { appList, appsDepartment, capped, isPublish } from "../lib/apps.ts";
import { api, ApiError } from "../lib/api.ts";
import { store, useHud } from "../lib/store.ts";
import { useVoice } from "../voice/useVoice.ts";
import { MicIcon } from "./ui.tsx";
import { FlatWave, speakerOf } from "./VoiceVisualizer.tsx";
import { Banner, Button, Loading } from "./ui.tsx";
import { BuildDepartment, DemolishDepartment } from "./Departments.tsx";
import { CityVisit } from "./CityVisit.tsx";
import { visitHash, type Visit } from "../lib/visit.ts";

const REGION_CITY: Record<string, string> = {
  "eu-north-1": "Stockholm",
  "eu-central-1": "Frankfurt",
  "eu-west-1": "Ireland",
  "us-east-1": "N. Virginia",
  "us-west-2": "Oregon",
};
const SWATCH = [
  "#c0533f",
  "#3f7fa8",
  "#3f8f6a",
  "#b5823a",
  "#7f5aa8",
  "#b84f78",
  "#4a6fb0",
  "#8d9440",
  "#b0663a",
  "#3f9a9a",
  "#a84848",
  "#5f7a8a",
];

type Open =
  | { agent: string }
  | { dept: string }
  | { build: true }
  | { record: "workforce" | "health" | "parked" | "legend" }
  | null;

export function CityView({
  go,
  visit = null,
}: {
  go: (view: string) => void;
  /** Inside a department's building (decision 166): on its street, or on one project's floor. */
  visit?: Visit | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CityScene | null>(null);
  const city = useHud((s) => s.city);
  const loaded = useHud((s) => s.loaded);
  const loadError = useHud((s) => s.loadError);
  const live = useHud((s) => s.live);
  const [open, setOpen] = useState<Open>(null);
  const [now, setNow] = useState(Date.now());
  const [earlier, setEarlier] = useState(false);
  const [health, setHealth] = useState<string | null>(null);
  const voice = useVoice();
  const speaker = speakerOf(useHud((s) => s.presence));

  // Every step into a building is a history entry, so Back undoes it; our own "back" buttons go back through
  // the same entries. A page opened straight on a building (a link) has none behind it: those steps replace.
  const depth = visit ? (visit.project ? 2 : 1) : 0;
  const base = useRef(depth);
  const outTo = (to: number) => {
    if (to >= depth) return;
    if (to >= base.current) return history.go(to - depth);
    base.current = to;
    location.replace(`#${to === 0 || !visit ? "/city" : visitHash(visit.dept)}`);
  };
  // Into a building in one move (decision 166): the map dives at the tower, slowly at first and then faster
  // (an ease-in), and the building arrives and settles (an ease-out). Out again, the map eases back from close up.
  const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const aim = (dept: string) => {
    const at = scene.current?.screenOf(dept);
    if (at && canvas.current) canvas.current.style.transformOrigin = `${at.x}px ${at.y}px`;
    return !!at;
  };
  const enter = (dept: string) => {
    setOpen(null);
    scene.current?.select(null);
    const arrive = () => go(visitHash(dept).slice(1));
    const c = canvas.current;
    if (!c || still() || !aim(dept)) return arrive();
    c.style.transition = "transform 500ms cubic-bezier(0.6, 0, 1, 0.5)";
    c.style.transform = "scale(5)";
    root.current?.classList.add("diving");
    setTimeout(arrive, 440);
  };
  const wasIn = useRef<string | null>(null);
  useEffect(() => {
    const c = canvas.current;
    root.current?.classList.toggle("diving", !!visit); // the map's panels stay away while inside, and fade back after
    if (visit) {
      wasIn.current = visit.dept;
      return;
    }
    const from = wasIn.current;
    wasIn.current = null;
    if (!c) return;
    if (!from || still()) {
      c.style.transition = "none";
      c.style.transform = "";
      return;
    }
    aim(from);
    c.style.transition = "none";
    c.style.transform = "scale(2.6)";
    void c.offsetWidth; // start from close up, then ease back
    c.style.transition = "transform 650ms cubic-bezier(0.16, 1, 0.3, 1)";
    c.style.transform = "";
  }, [visit?.dept]);
  useEffect(() => {
    if (open && "agent" in open && !visit?.project) setOpen(null); // left the floor: its agent's card goes too
    if (open && "dept" in open && visit) setOpen(null);
  }, [visit?.dept, visit?.project, visit?.part]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Mount the scene once; feed it the snapshot and every event after it.
  useEffect(() => {
    if (!root.current || !canvas.current) return;
    const wide = () =>
      root.current!.clientWidth >= 800 ? { l: 0, t: 64, r: 250, b: 70 } : { l: 0, t: 140, r: 0, b: 254 };
    const s = mountCity(root.current, {
      canvas: canvas.current,
      insets: wide,
      onSelectAgent: (id) => setOpen(id ? { agent: id } : null),
      // A department's tower: go and stand in front of it. HQ keeps its card.
      onSelectBuilding: (dept) => (dept === "HQ" ? setOpen({ dept }) : enter(dept)),
      onOpenApp: (slug) => go(`apps/${encodeURIComponent(slug)}`),
    });
    scene.current = s;
    s.load(snapshotOf(store.get().city));
    const off = (e: unknown) => s.onEvent(e);
    store.sceneEvents.add(off);
    return () => {
      store.sceneEvents.delete(off);
    };
  }, []);
  // A fresh snapshot (first load, reconnect) rebuilds the scene's copy — never a mere event, whose reload
  // would wipe walks in progress and activity bubbles (the scene already gets every event itself).
  const loadedAt = useHud((s) => s.snapshotAt);
  useEffect(() => {
    if (loadedAt && scene.current) scene.current.load(snapshotOf(store.get().city));
  }, [loadedAt]);

  const t = topBar(city);
  const names = standingDepartments(city);
  const jobsRunning = Object.values(city.tickets).filter((x) => x.kind === "task" && !x.parent_id).length;
  const lines = stories(city.feed, earlier ? 40 : 9);
  const toggleHealth = () => {
    if (health !== null) return setHealth(null);
    setHealth("Checking…");
    void api<{ stale_turns?: number }>("/health").then(
      (h) => {
        const stuck = Number(h.stale_turns ?? 0);
        const held = t.parked;
        setHealth(
          [
            stuck ? `${stuck === 1 ? "1 thing is" : `${stuck} things are`} stuck.` : "Everything is running normally.",
            held ? `${held === 1 ? "1 job is" : `${held} jobs are`} on hold (see Records, On hold).` : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      },
      () => setHealth("Couldn't check right now."),
    );
  };
  const region = (city as CityState & { region?: string }).region ?? "eu-north-1";

  return (
    <section className="city" ref={root} aria-label="City view">
      {/* The refraction behind the City's glass boxes (decision 153): defined once, used by .cityui. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <filter id="city-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves={2} seed={3} result="noise" />
          <feGaussianBlur in="noise" stdDeviation={2} result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale={28} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <canvas
        ref={canvas}
        aria-label="The city of the agents as a small map. Every building and agent is also listed under Departments and in the panel."
      />
      <div className="cityui citytop" role="status" aria-label="The city right now">
        <CityTabs on="city" />
        <Stat k="Agents working now" v={String(t.agentsActive)} />
        <Stat k="Jobs running" v={String(jobsRunning)} />
        <Stat k={REGION_CITY[region] ?? region} v={stockholmTime(now)} className="clock" />
        <button
          type="button"
          className="info"
          onClick={toggleHealth}
          aria-expanded={health !== null}
          aria-label="Is everything running normally?"
          title="Is everything running normally?"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 11v6M12 7.5v.01" />
          </svg>
        </button>
        {health !== null ? <p className="healthline">{health}</p> : null}
      </div>
      <div className="cityalerts">
        {!loaded && !loadError ? <Loading what="the city" /> : null}
        {loadError ? (
          <Banner tone="bad">{`Can't reach AI City (${loadError}). Nothing is shown until it answers.`}</Banner>
        ) : null}
        {live === "reconnecting" ? (
          <Banner tone="bad">Live updates stopped. Reconnecting… The map catches up when it is back.</Banner>
        ) : null}
        {city.capHit ? (
          <Banner
            tone="bad"
            action={{ label: "See costs", onClick: () => go("costs") }}
          >{`You reached your ${city.capHit.cap === "daily_global" ? "daily" : city.capHit.cap.replace(/_/g, " ")} spending limit ($${city.capHit.limit}). No new work starts until you raise it in Settings.`}</Banner>
        ) : null}
        {loaded && !names.length ? (
          <p className="cityui empty">
            No departments yet. A building goes up on the next free lot the moment a task needs one.
          </p>
        ) : null}
      </div>
      <aside className="cityside">
        <nav className="cityui depts" aria-label="Departments">
          <h3 className="pixel">Departments</h3>
          <button
            type="button"
            className="dept"
            style={{ ["--swatch" as string]: "#3f5f92" }}
            onClick={() => setOpen({ dept: "HQ" })}
          >
            HQ
          </button>
          {names.map((n, i) => {
            const count = Object.values(city.agents).filter(
              (a) => a.department === n && a.kind === "worker" && a.state === "active",
            ).length;
            return (
              <button
                key={n}
                type="button"
                className="dept"
                style={{ ["--swatch" as string]: SWATCH[i % SWATCH.length] }}
                onClick={() => setOpen({ dept: n })}
              >
                {n}
                {count ? <span className="working">{`· ${count} working`}</span> : null}
              </button>
            );
          })}
          <button type="button" className="dept rec build" onClick={() => setOpen({ build: true })}>
            + Build a department
          </button>
          <h3 className="pixel">Records</h3>
          <button type="button" className="dept rec" onClick={() => setOpen({ record: "workforce" })}>
            Workforce
          </button>
          <button type="button" className="dept rec" onClick={() => go("costs")}>
            Costs (estimates)
          </button>
          <button type="button" className="dept rec" onClick={() => setOpen({ record: "health" })}>
            Health
          </button>
          <button
            type="button"
            className="dept rec"
            onClick={() => setOpen({ record: "parked" })}
          >{`On hold (${t.parked})`}</button>
          <button type="button" className="dept rec" onClick={() => setOpen({ record: "legend" })}>
            What the marks mean
          </button>
        </nav>
        <div className="cityui feed" aria-live="polite" tabIndex={0} role="log" aria-label="Activity">
          <h3 className="pixel">Activity</h3>
          {lines.length ? (
            <>
              {lines.slice(0, earlier ? 40 : 8).map((f, i) => (
                <div key={`${f.at}-${i}`} className={`fline ${f.kind}`}>
                  <span className="t">
                    {new Date(f.at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span>{f.text}</span>
                </div>
              ))}
              {!earlier && lines.length > 8 ? (
                <button type="button" className="more" onClick={() => setEarlier(true)}>
                  Earlier…
                </button>
              ) : null}
            </>
          ) : (
            <p className="mute">Quiet.</p>
          )}
        </div>
      </aside>
      <div className="citybottom" role="toolbar" aria-label="Map and actions">
        <div className="zoom">
          <button type="button" className="tile" onClick={() => scene.current?.zoomIn()} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="tile" onClick={() => scene.current?.zoomOut()} aria-label="Zoom out">
            -
          </button>
          <button type="button" className="tile" onClick={() => scene.current?.fit()} aria-label="Fit the whole map">
            Fit
          </button>
        </div>
        <div
          className={`actions dockbar${voice.listening || speaker !== "idle" ? " live" : ""}`}
          data-speaker={speaker}
        >
          <button type="button" className="dockbtn" onClick={() => go("vaic")} aria-label="Chat with VAIC">
            <Glyph d="M4 5h16v10H9l-5 4z" />
          </button>
          <button type="button" className="dockbtn" onClick={() => go("tickets")} aria-label="Tickets">
            <Glyph d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
          </button>
          <div className="dockvoice">
            <button
              type="button"
              className={`dockbtn dockmic ${voice.listening ? "on" : ""}`}
              onClick={voice.pushToTalk}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop listening" : "Talk to VAIC"}
            >
              <MicIcon size={20} />
            </button>
            <span className="docklive">
              <FlatWave speaker={speaker} />
              <span className="dockwho" aria-hidden="true">
                {speaker === "you"
                  ? "You"
                  : speaker === "vaic"
                    ? "VAIC"
                    : speaker === "thinking"
                      ? "Thinking"
                      : "Listening"}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="dockbtn"
            onClick={voice.toggleSound}
            aria-pressed={voice.sound}
            aria-label={voice.sound ? "Sound on (tap to mute)" : "Sound off (tap to turn on)"}
          >
            <Glyph
              d={voice.sound ? "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6" : "M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6"}
            />
          </button>
          <button type="button" className="dockbtn" onClick={() => go("costs")} aria-label="Charts and costs">
            <Glyph d="M5 19V9M10 19V5M15 19v-7M20 19v-4" />
          </button>
        </div>
      </div>
      {visit ? (
        <CityVisit
          key={visit.dept}
          dept={visit.dept}
          project={visit.project}
          part={visit.part}
          city={city}
          slot={scene.current?.building(visit.dept)?.slot ?? names.indexOf(visit.dept)}
          turned={open && "agent" in open ? open.agent : null}
          onPick={(p, part) => {
            // Into a project is a step Back undoes; from floor to floor inside the building is not.
            const to = visitHash(visit.dept, p, part);
            if (visit.project) location.replace(`#${to}`);
            else go(to.slice(1));
          }}
          onBack={() => outTo(depth - 1)}
          onExit={() => outTo(0)}
          onAgent={(id) => setOpen({ agent: id })}
        />
      ) : null}
      {open ? (
        <CityPanel
          open={open}
          city={city}
          onClose={() => {
            setOpen(null);
            scene.current?.select(null);
          }}
          onZoom={(d) => scene.current?.focusBuilding(d)}
          onVisit={enter}
          onBuilt={(d) => {
            setOpen({ dept: d });
            setTimeout(() => scene.current?.focusBuilding(d), 400);
          }}
        />
      ) : null}
    </section>
  );
}

function snapshotOf(city: CityState) {
  return {
    agents: Object.values(city.agents),
    departments: Object.values(city.departments).map((d) => ({ ...d, created_at: new Date(d.builtAt).toISOString() })),
    tickets: Object.values(city.tickets),
    parked: Object.values(city.parked),
    questions: Object.values(city.questions),
    approvals: Object.values(city.approvals),
    apps: Object.values(city.apps ?? {}),
    connectors: Object.values(city.connectors ?? {}),
    usage: city.usage,
    spend: city.spend,
    caps: city.caps,
    city: city.city,
  };
}

const Stat = ({ k, v, title, className }: { k: string; v: string; title?: string; className?: string }) => (
  <div className={`stat ${className ?? ""}`} title={title}>
    <span className="k">{k}</span>
    <b>{v}</b>
  </div>
);
const Glyph = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

export function CityPanel({
  open,
  city,
  onClose,
  onZoom,
  onVisit,
  onBuilt,
}: {
  open: NonNullable<Open>;
  city: CityState;
  onClose: () => void;
  onZoom: (dept: string) => void;
  onVisit?: (dept: string) => void;
  onBuilt?: (dept: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // onClose is a new function on every render of the city; read through a ref so this effect runs only when
  // the panel opens for something else. Otherwise every city update moved the focus to Close mid-typing.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const title =
    "agent" in open
      ? (city.agents[open.agent]?.role ?? open.agent)
      : "build" in open
        ? "Build a department"
        : "dept" in open
          ? open.dept === "HQ"
            ? "Headquarters"
            : `${open.dept} department`
          : { workforce: "Workforce", health: "Health", parked: "On hold", legend: "What the marks mean" }[open.record];
  return (
    <aside className="cityui citypanel" role="dialog" aria-label={title} ref={ref}>
      <header>
        <h3 className="pixel">{title}</h3>
        <button type="button" className="closer" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {"agent" in open ? <AgentPanel key={open.agent} id={open.agent} city={city} /> : null}
      {"build" in open ? <BuildDepartment compact onDone={onBuilt} /> : null}
      {"dept" in open ? (
        <DeptPanel name={open.dept} city={city} onZoom={onZoom} onVisit={onVisit} onGone={onClose} />
      ) : null}
      {"dept" in open ? <DeptApps name={open.dept} city={city} /> : null}
      {"record" in open && open.record === "legend" ? <Legend /> : null}
      {"record" in open && open.record === "parked" ? <Parked city={city} /> : null}
      {"record" in open && (open.record === "workforce" || open.record === "health") ? (
        <Remote what={open.record} />
      ) : null}
    </aside>
  );
}

function AgentPanel({ id, city }: { id: string; city: CityState }) {
  const a = city.agents[id];
  const [live, setLive] = useState<{
    cost_usd: number;
    recent: Array<{ tool: string; decision: string; at: string }>;
  } | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [homeAsk, setHomeAsk] = useState(false);
  const [homeNote, setHomeNote] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    if (a && a.kind !== "specialist")
      void api<{ cost_usd: number; recent: Array<{ tool: string; decision: string; at: string }> }>(
        `/city/agent?id=${encodeURIComponent(id)}`,
      ).then(
        (r) => !gone && setLive(r),
        () => undefined,
      );
    return () => {
      gone = true;
    };
  }, [id, a]);
  if (!a) return <p className="mute">This agent is no longer in the city.</p>;
  const doing = VISUALS[visualState(city, id)] ?? VISUALS.idle!;
  const ticket = Object.values(city.tickets).find((t) => t.to === id);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await instruct(id, text.trim());
      setNote("Sent. Its manager is copied.");
      setText("");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Not sent. Try again.");
    }
  };
  const atWork = a.kind === "worker" && a.state !== "retired" && a.worker_state !== "released";
  const sendHome = async () => {
    setHomeAsk(false);
    try {
      await sendWorkerHome(id);
      setHomeNote("Walking home. Its unfinished part is stopped; nobody takes its place.");
    } catch (err) {
      setHomeNote(err instanceof ApiError ? err.message : "Not sent home. Try again.");
    }
  };
  return (
    <div>
      <p className="doing">
        <b>{doing.label}.</b> {a.kind === "specialist" ? "A saved specialist, at home until hired again." : doing.words}
      </p>
      <Row k="Department" v={a.department ?? "Headquarters"} />
      <Row k="Model" v={MODEL_NAME[a.model] ?? a.model} />
      <Row k="Reports to" v={a.parent ?? "the owner"} />
      <h4>Working on</h4>
      <p>{ticket ? `${ticketWords(ticket.status)}: ${plainText(ticket.goal).short}` : "Nothing right now."}</p>
      {live?.recent.length ? (
        <>
          <h4>Recent activity</h4>
          <ul className="recent">
            {live.recent.slice(-6).map((r, i) => (
              <li
                key={i}
              >{`${new Date(r.at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} ${r.tool.replace(/^mcp__city__/, "").replace(/_/g, " ")}${r.decision === "deny" ? " (blocked by policy)" : ""}`}</li>
            ))}
          </ul>
        </>
      ) : null}
      {a.kind !== "specialist" && a.state !== "retired" ? (
        <form className="instruct" onSubmit={send}>
          <label>
            Instruct this agent
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell it something…" />
          </label>
          <Button variant="secondary" type="submit">
            Send
          </Button>
          {note ? <p className="mute">{note}</p> : null}
        </form>
      ) : null}
      {atWork ? (
        <div className="sendhome">
          {homeAsk ? (
            <>
              <p>Send this worker home? Its unfinished part stops and nobody takes its place.</p>
              <div className="actions">
                <Button variant="danger" onClick={sendHome}>
                  Yes, send home
                </Button>
                <Button variant="quiet" onClick={() => setHomeAsk(false)}>
                  Keep working
                </Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setHomeAsk(true)}>
              Send home
            </Button>
          )}
        </div>
      ) : null}
      {homeNote ? <p className="mute">{homeNote}</p> : null}
    </div>
  );
}

function DeptPanel({
  name,
  city,
  onZoom,
  onVisit,
  onGone,
}: {
  name: string;
  city: CityState;
  onZoom: (d: string) => void;
  onVisit?: (d: string) => void;
  onGone: () => void;
}) {
  const d = city.departments[name];
  if (d?.state === "demolished") return <p className="doing">{`${name} was demolished. Its lot stands empty.`}</p>;
  const members = Object.values(city.agents).filter(
    (a) => (name === "HQ" ? a.kind === "core" : a.department === name) && a.state !== "retired",
  );
  const workers = members.filter((a) => a.kind === "worker");
  const open = Object.values(city.tickets).filter((t) => members.some((m) => m.id === t.to));
  return (
    <div>
      <p className="doing">
        {name === "HQ"
          ? "VAIC and the team lead work here."
          : `${workers.length ? `${workers.length} workers at their desks.` : "Nobody hired right now."} ${d?.mission ?? ""}`}
      </p>
      {name !== "HQ" ? <Row k="Manager" v={d?.manager_id ? `${d.manager_id} · Fable 5.1` : "—"} /> : null}
      {name !== "HQ" ? (
        <Row k="Workers run on" v={d?.worker_model === "fable-5-1" ? "Fable 5.1" : workerModel(name)} />
      ) : null}
      <h4>{`Work in progress (${open.length})`}</h4>
      <ul className="recent">
        {open.length ? (
          open.map((t) => <li key={t.id}>{`${t.to}: ${ticketWords(t.status)} — ${plainText(t.goal, 90).short}`}</li>)
        ) : (
          <li className="mute">None right now.</li>
        )}
      </ul>
      {name !== "HQ" && onVisit ? <Button onClick={() => onVisit(name)}>Go inside</Button> : null}
      <Button variant="secondary" onClick={() => onZoom(name)}>
        Zoom in
      </Button>
      {name !== "HQ" && d ? <DemolishDepartment name={name} city={city} onDone={onGone} /> : null}
    </div>
  );
}
// The presets whose workers run on Fable 5.1 (decision 129, `departmentModels` in config/models.json).
const FABLE_WORKERS = new Set(["media", "research", "legal"]);
const workerModel = (name: string) => (FABLE_WORKERS.has(name.trim().toLowerCase()) ? "Fable 5.1" : "Opus 5.5");

// The Apps building's own part of its panel: what waits for the owner, and every app it built (the
// same as the cabinets on the map, for keyboards and screen readers).
function DeptApps({ name, city }: { name: string; city: CityState }) {
  const mine = (x: { department?: string | null }) => appsDepartment(x).toLowerCase() === name.toLowerCase();
  const apps = appList(city.apps).filter(mine);
  const waiting = Object.values(city.approvals).filter((a) => isPublish(a) && mine(a));
  if (!apps.length && !waiting.length) return null;
  return (
    <div>
      {waiting.length ? (
        <p className="doing">
          <b>Ready to try.</b> {`${waiting.map((a) => capped(a.title, 40)).join(", ")} is ready to try in `}
          <a href="#/settings/open-items">Open items</a>.
        </p>
      ) : null}
      {apps.length ? (
        <>
          <h4>{`Apps built here (${apps.length})`}</h4>
          <ul className="recent">
            {apps.map((a) => (
              <li key={a.app_id}>
                <a href={`#/apps/${encodeURIComponent(a.slug)}`}>{capped(a.title, 40)}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <span className="mark">Figure at a desk</span> working, or holding its place
      </li>
      <li>
        <span className="mark">Figure in a yard</span> off work, or a saved specialist at home
      </li>
      <li>
        <span className="mark">Figure at a door</span> the department's manager
      </li>
      <li>
        <span className="mark">Yellow “!” bubble, glowing</span> needs you
      </li>
      <li>
        <span className="mark">Red ✕ bubble</span> failed or blocked
      </li>
      <li>
        <span className="mark">Number badge on a roof</span> how many people are at their desks
      </li>
      <li>
        <span className="mark">Arcade cabinet by a door</span> an app you published; tap it to open it
      </li>
      <li>
        <span className="mark">“Waiting for you” sign</span> a new app is ready to try in Open items
      </li>
      <li>
        <span className="mark">Yellow cab</span> someone riding to work or home (the others just cruise the streets)
      </li>
      <li>
        <span className="mark">Mailman on a bike</span> a letter between the Orchestrator and a department's manager: a
        new goal going out, or the answer coming back
      </li>
      <li>
        <span className="mark">Crane and scaffolding</span> a department being built; a wrecking ball means one is being
        demolished
      </li>
      {Object.entries(VISUALS).map(([k, v]) => (
        <li key={k}>
          <span className="mark">{v.label}</span> {v.words}
        </li>
      ))}
    </ul>
  );
}

function Parked({ city }: { city: CityState }) {
  const rows = Object.values(city.parked);
  return rows.length ? (
    <ul className="recent">
      {rows.map((t) => (
        <li key={t.id}>{`${t.to}: ${plainText(t.goal, 90).short}`}</li>
      ))}
    </ul>
  ) : (
    <p className="mute">Nothing is on hold.</p>
  );
}

function Remote({ what }: { what: "workforce" | "health" }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void api<Record<string, unknown>>(`/${what}`).then(setData, (e: Error) => setErr(e.message));
  }, [what]);
  if (err) return <Banner tone="bad">{`Could not load ${what} (${err}).`}</Banner>;
  if (!data) return <Loading what={what} />;
  if (what === "health")
    return (
      <div>
        <Row k="City" v="Running" />
        <Row k="Workers busy" v={`${String(data.workers_busy)} of ${String(data.worker_ceiling)}`} />
        <Row k="Stuck turns" v={String(data.stale_turns)} />
      </div>
    );
  const workers =
    (data.workers as Array<{
      id: string;
      role: string;
      department: string;
      worker_state: string;
      state: string;
      total_cost_usd: number;
    }>) ?? [];
  const specialists = (data.specialists as Array<{ id: string; specialty: string; department: string }>) ?? [];
  return (
    <div>
      <p>{`${workers.length} hired ever · ${workers.filter((w) => w.state === "active").length} working now · ${specialists.length} saved specialists`}</p>
      <ul className="recent">
        {workers.slice(-30).map((w) => (
          <li
            key={w.id}
          >{`${w.id} — ${w.role}, ${w.department}: ${(w.worker_state ?? w.state).replace(/_/g, " ")}`}</li>
        ))}
      </ul>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="row">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);
