// Inside a building (decision 166). From the map, a department's tower opens here: you stand on the street in
// front of its doors and pick one of its projects; the view flies up the outside of the tower and through the
// glass into that project's floor, where its manager and workers sit at their desks facing their monitors.
// Clicking one turns their chair to you and opens their card. "City map" (and Esc, and Back) goes out again.
// Drawn with plain HTML and CSS 3D transforms over the map, in the City's pixel style: no extra library.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MODEL_NAME, VISUALS, visualState, type CityState } from "../city/city-state.js";
import { agentSprite, towerLook } from "../city/scene.js";
import { deptProjects, type VisitProject } from "../lib/visit.ts";

const FLOOR_PX = 46; // one storey on the street view
const RISE_MS = 1100;
const ENTER_MS = 650;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Phase = "street" | "rise" | "enter" | "floor";

export function CityVisit({
  dept,
  project,
  city,
  slot,
  turned,
  onPick,
  onBack,
  onExit,
  onAgent,
}: {
  dept: string;
  project: string | null;
  city: CityState;
  /** The tower's slot on the map, so the colours match. */
  slot: number;
  /** The agent whose card is open: their chair is turned to you. */
  turned: string | null;
  onPick: (project: string) => void;
  /** One step out: from a floor to the street, from the street to the map. */
  onBack: () => void;
  /** All the way out to the map. */
  onExit: () => void;
  onAgent: (id: string) => void;
}) {
  const projects = useMemo(() => deptProjects(city, dept), [city, dept]);
  const chosen = project ? (projects.find((p) => p.id === project) ?? null) : null;
  const look = towerLook(dept, slot);
  // The fly plays only when a project is picked here; a link or a Back straight to a floor cuts to it.
  const [phase, setPhase] = useState<Phase>(project ? "floor" : "street");
  const flying = useRef(false);
  useEffect(() => {
    if (!project) {
      flying.current = false;
      setPhase("street");
      return;
    }
    if (!flying.current || reducedMotion()) {
      setPhase("floor");
      return;
    }
    setPhase("rise");
    const a = setTimeout(() => setPhase("enter"), RISE_MS);
    const b = setTimeout(() => {
      flying.current = false;
      setPhase("floor");
    }, RISE_MS + ENTER_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [project]);
  const pick = (id: string) => {
    flying.current = true;
    onPick(id);
  };

  // Esc goes one step out, like Back; not while an agent's card is open (Esc closes the card first).
  const back = useRef(onBack);
  back.current = onBack;
  const card = useRef(turned);
  card.current = turned;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || card.current || e.defaultPrevented) return;
      e.preventDefault();
      back.current();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === "street" || phase === "floor") heading.current?.focus();
  }, [phase, dept]);

  const where = chosen && phase === "floor" ? `Floor ${chosen.floor} · ${chosen.title}` : "On the street";
  return (
    <section
      className={`visit visit-${phase}`}
      aria-label={`${dept} building`}
      data-phase={phase}
      style={
        {
          "--wall": look.wall,
          "--shade": look.shade,
          "--trim": look.trim,
          "--glass": look.glass,
          "--accent": look.accent,
          "--accent-light": look.light,
          "--accent-dark": look.dark,
        } as CSSProperties
      }
    >
      {phase === "floor" && chosen ? (
        <Office project={chosen} city={city} dept={dept} turned={turned} onAgent={onAgent} />
      ) : (
        <Street
          dept={dept}
          floors={Math.max(8, projects.length + 3)}
          target={phase === "street" ? null : (chosen?.floor ?? 2)}
          phase={phase}
          lit={projects.map((p) => p.floor)}
        />
      )}
      {phase === "enter" ? <div className="visit-glass" aria-hidden="true" /> : null}
      <header className="visithead cityui">
        <button type="button" className="visitout" onClick={onExit}>
          <span aria-hidden="true">←</span> City map
        </button>
        <h2 ref={heading} tabIndex={-1} className="pixel">
          {dept}
          <small>{where}</small>
        </h2>
        {phase === "floor" ? (
          <button type="button" className="visitback" onClick={onBack}>
            Other projects
          </button>
        ) : null}
      </header>
      {phase === "street" ? <Picker dept={dept} projects={projects} onPick={pick} /> : null}
      {phase === "rise" || phase === "enter" ? (
        <p className="visitnote cityui" role="status">{`Going up to floor ${chosen?.floor ?? ""}…`}</p>
      ) : null}
      {phase === "floor" && !chosen ? (
        <div className="visitpick cityui">
          <p>This project is finished or no longer here.</p>
          <button type="button" className="visitback" onClick={onBack}>
            Other projects
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Picker({ dept, projects, onPick }: { dept: string; projects: VisitProject[]; onPick: (id: string) => void }) {
  return (
    <nav className="visitpick cityui" aria-label={`Projects in ${dept}`}>
      <h3 className="pixel">Pick a project</h3>
      {projects.length ? (
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              <button type="button" className="visitproject" onClick={() => onPick(p.id)}>
                <span className="floorno pixel">{`${p.floor}F`}</span>
                <span className="what">
                  <b>{p.title}</b>
                  <small>{`${p.status} · ${p.agents.length === 1 ? "1 agent" : `${p.agents.length} agents`}`}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mute">{`Nobody in ${dept} is working on a project right now. Ask VAIC for something and it shows up here.`}</p>
      )}
    </nav>
  );
}

// The tower from across the street, looking up at it: storeys of windows, the lit ones are projects.
function Street({
  dept,
  floors,
  target,
  phase,
  lit,
}: {
  dept: string;
  floors: number;
  target: number | null;
  phase: Phase;
  lit: number[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The street line (the foot of the tower) sits at 80% of the height, your eyes at 45%.
  const street = size.h * 0.8,
    eye = size.h * 0.45;
  let transform = "none",
    origin = "50% 50%";
  if (target !== null && size.h) {
    const winY = street - ((target - 1) * FLOOR_PX + FLOOR_PX / 2);
    const rise = eye - winY; // move the tower down until that storey is level with your eyes
    origin = `${size.w / 2}px ${winY}px`;
    transform = phase === "enter" ? `translateY(${rise}px) scale(7)` : `translateY(${rise}px)`;
  }
  const lights = new Set(lit);
  return (
    <div className="visitstreet" ref={box} aria-hidden="true">
      <div className="sky" />
      <div className="skyline" />
      <div
        className="visitcam"
        style={{
          transform,
          transformOrigin: origin,
          transitionDuration: phase === "enter" ? `${ENTER_MS}ms` : `${RISE_MS}ms`,
        }}
      >
        <div className="facade" style={{ height: floors * FLOOR_PX + 60, bottom: `calc(20% - 4px)` }}>
          <div className="crown" />
          {Array.from({ length: floors }, (_, i) => floors - i).map((n) => (
            <div
              key={n}
              className={`storey${n === 1 ? " lobby" : ""}${lights.has(n) ? " lit" : ""}${n === target ? " target" : ""}`}
            >
              {n === 1 ? (
                <>
                  <span className="sign pixel">{dept}</span>
                  <span className="doors" />
                </>
              ) : (
                <>
                  {Array.from({ length: 7 }, (_, k) => (
                    <span key={k} className="win" />
                  ))}
                  {lights.has(n) ? <span className="floorno pixel">{`${n}F`}</span> : null}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="pavement" />
        <div className="road" />
      </div>
    </div>
  );
}

// The project's floor, at the eye level of someone sitting at a desk.
function Office({
  project,
  city,
  dept,
  turned,
  onAgent,
}: {
  project: VisitProject;
  city: CityState;
  dept: string;
  turned: string | null;
  onAgent: (id: string) => void;
}) {
  const shown = project.agents.slice(0, 12);
  const perRow = shown.length <= 2 ? 2 : shown.length <= 6 ? 3 : 4;
  return (
    <div className="office">
      <div className="officewall" aria-hidden="true">
        <div className="officewindows">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <span className="officesign pixel">{`${project.floor}F · ${dept}`}</span>
      </div>
      <div className="officefloorwrap" aria-hidden="true">
        <div className="officefloor" />
      </div>
      <ul className="desks" aria-label={`Who works on ${project.title}`}>
        {shown.map((id, i) => {
          const a = city.agents[id]!;
          const col = i % perRow;
          const depth = Math.floor(i / perRow); // 0 = nearest: the manager's row
          const scale = 1 / (1 + depth * 0.5);
          const step = (78 / perRow) * scale;
          // Rows further back sit higher (nearer the horizon) and half a desk across, so nobody hides behind anyone.
          const x = 50 + (col - (perRow - 1) / 2) * step + (depth % 2 ? step / 2 : 0);
          const y = 50 + 42 * scale;
          const doing = VISUALS[visualState(city, id)] ?? VISUALS.idle!;
          const on = turned === id;
          return (
            <li
              key={id}
              className={`desk${on ? " turned" : ""}`}
              style={{ left: `${x}%`, top: `${y}%`, zIndex: 10 - depth, ["--s" as string]: String(scale) }}
            >
              <span className="monitor" aria-hidden="true" />
              <span className="tabletop" aria-hidden="true" />
              <button
                type="button"
                className="agent"
                onClick={() => onAgent(id)}
                aria-pressed={on}
                aria-label={`${a.role}${a.kind === "manager" ? " (manager)" : ""}, ${doing.label.toLowerCase()}, ${MODEL_NAME[a.model] ?? a.model}. Turn to face you and open their card.`}
              >
                <span className="chair" aria-hidden="true">
                  <img className="back" src={agentSprite(a, "back")} alt="" />
                  <img className="front" src={agentSprite(a, "front")} alt="" />
                  <span className="seat" />
                </span>
                <span className="tag pixel" aria-hidden="true">
                  {a.kind === "manager" ? "Manager" : a.role}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {project.agents.length > shown.length ? (
        <p className="officemore pixel">{`+${project.agents.length - shown.length} more on this floor`}</p>
      ) : null}
      {!shown.length ? <p className="officemore">Nobody is at a desk on this floor right now.</p> : null}
    </div>
  );
}
