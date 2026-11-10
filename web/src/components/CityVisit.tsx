// Inside a building (decision 166). From the map, a department's tower opens here as a cutaway seen from above
// at an angle (isometric, never first person): its floors stacked, one per project. Picking a project brings its
// floor into focus and fades the others to a tenth, so the eye stays on that floor: the manager and the workers
// on that project at their desks. Clicking one turns their chair to you and opens their card. "City map" (and
// Esc, and Back) goes out again. Pixel art drawn in code (lib/officeArt.ts) with plain HTML over it: no library.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MODEL_NAME, VISUALS, visualState, type CityState } from "../city/city-state.js";
import { towerLook } from "../city/scene.js";
import {
  FLOOR_PITCH,
  PERSON_H,
  PERSON_W,
  floorPlan,
  paintFloor,
  personSprite,
  type FloorPlan,
} from "../lib/officeArt.ts";
import { deptProjects, type VisitProject } from "../lib/visit.ts";

const SEATS_MAX = 12; // on a wide screen; a phone's room holds eight

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
  /** One step out: from a floor to the whole building, from the building to the map. */
  onBack: () => void;
  /** All the way out to the map. */
  onExit: () => void;
  onAgent: (id: string) => void;
}) {
  const projects = useMemo(() => deptProjects(city, dept), [city, dept]);
  const chosen = project ? (projects.find((p) => p.id === project) ?? null) : null;
  const look = towerLook(dept, slot);
  const phase = chosen ? "floor" : "building";

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
  useEffect(() => heading.current?.focus(), [phase, dept]);

  // The stage, and a size for the rooms that fits it: every floor of a building is the same room.
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const set = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = size.w >= 800;
  const cols = wide ? 4 : 2;
  const most = Math.min(wide ? SEATS_MAX : 8, Math.max(1, ...projects.map((p) => p.agents.length)));
  const plan = useMemo(() => floorPlan(cols, Math.max(2, Math.ceil(most / cols))), [cols, most]);
  // The room's free space: beside the project list on a wide screen, above it on a phone.
  const area = wide
    ? { x: 12, y: 78, w: size.w - 376, h: size.h - 90 }
    : { x: 8, y: 140, w: size.w - 16, h: (phase === "floor" ? size.h - 12 : size.h * 0.56) - 140 };
  const scale = Math.max(0.5, Math.min(3, Math.floor(Math.min(area.w / plan.W, area.h / plan.H) * 20) / 20));
  // The whole tower: the lobby, a floor per project, two storeys above. Only project floors can be in focus; the
  // rest is the building's shell, always faint.
  const floors: Array<VisitProject | "shell" | null> = [
    "shell",
    ...(projects.length ? projects : [null]),
    "shell",
    "shell",
  ];
  const top = (i: number) => (floors.length - 1 - i) * FLOOR_PITCH * scale; // the lobby at the bottom
  const focus = chosen ? floors.indexOf(chosen) : -1;
  const stackH = top(0) + plan.H * scale;
  // With no floor in focus the whole stack is in view, smaller if it has to be.
  const zoom = focus >= 0 ? 1 : Math.min(1, area.h / stackH);
  const centre = focus >= 0 ? top(focus) + (plan.H * scale) / 2 : stackH / 2;
  const move = {
    x: Math.round(area.x + (area.w - plan.W * scale * zoom) / 2),
    y: Math.round(area.y + area.h / 2 - centre * zoom),
  };

  return (
    <section
      className={`visit visit-${phase}`}
      aria-label={`${dept} building`}
      data-phase={phase}
      style={{ "--accent": look.accent } as CSSProperties}
    >
      <div className="visitstage" ref={stage}>
        {size.w ? (
          <div className="floorstack" style={{ transform: `translate(${move.x}px, ${move.y}px) scale(${zoom})` }}>
            {floors.map((f, i) => {
              const p = f === "shell" ? null : f;
              return (
                <Floor
                  key={p?.id ?? `shell${i}`}
                  plan={plan}
                  scale={scale}
                  top={top(i)}
                  project={p}
                  dept={dept}
                  city={city}
                  look={look}
                  state={f === "shell" ? "faded" : !p ? "empty" : focus < 0 ? "open" : focus === i ? "focus" : "faded"}
                  turned={turned}
                  onPick={onPick}
                  onAgent={onAgent}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <header className="visithead cityui">
        <button type="button" className="visitout" onClick={onExit}>
          <span aria-hidden="true">←</span> City map
        </button>
        <h2 ref={heading} tabIndex={-1} className="pixel">
          {dept}
          <small>{chosen ? `Floor ${chosen.floor} · ${chosen.title}` : "All floors"}</small>
        </h2>
        {chosen ? (
          <button type="button" className="visitback" onClick={onBack}>
            All floors
          </button>
        ) : null}
      </header>
      <nav className="visitpick cityui" aria-label={`Projects in ${dept}`}>
        <h3 className="pixel">{chosen ? "Projects" : "Pick a project"}</h3>
        {project && !chosen ? <p className="mute">That project is finished or no longer here.</p> : null}
        {projects.length ? (
          <ul>
            {[...projects].reverse().map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="visitproject"
                  aria-current={p === chosen ? "true" : undefined}
                  onClick={() => onPick(p.id)}
                >
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
    </section>
  );
}

// One floor of the stack: the room on a canvas, the people in their chairs over it.
function Floor({
  plan,
  scale,
  top,
  project,
  dept,
  city,
  look,
  state,
  turned,
  onPick,
  onAgent,
}: {
  plan: FloorPlan;
  scale: number;
  top: number;
  project: VisitProject | null;
  dept: string;
  city: CityState;
  look: { wall: string; shade: string };
  /** In focus, faded behind the floor in focus, one of all the floors (none picked), or an empty building. */
  state: "focus" | "faded" | "open" | "empty";
  turned: string | null;
  onPick: (project: string) => void;
  onAgent: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useMemo(
    () => (project?.agents ?? []).slice(0, plan.seats.length).filter((id) => city.agents[id]),
    [project, plan, city.agents],
  );
  const seed = `${dept}:${project?.id ?? top}`;
  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (g) paintFloor(g, plan, { seed, people: shown.length, wall: look.wall, wall2: look.shade });
  }, [plan, seed, shown.length, look.wall, look.shade]);
  const more = (project?.agents.length ?? 0) - shown.length;
  return (
    // A floor that is not in focus is a picture you can click to pick it; the project list does the same by keyboard.
    <div
      className={`floor floor-${state}`}
      style={{ top, width: plan.W * scale, height: plan.H * scale }}
      onClick={state === "open" && project ? () => onPick(project.id) : undefined}
      aria-hidden={state === "focus" ? undefined : true}
    >
      <canvas ref={canvas} width={plan.W} height={plan.H} aria-hidden="true" />
      {project ? (
        <span
          className="floortag pixel"
          aria-hidden="true"
          style={{ left: plan.corner.x * scale, top: plan.corner.y * scale }}
        >{`${project.floor}F`}</span>
      ) : null}
      <ul
        className="desks"
        aria-label={project ? `Who works on ${project.title}` : undefined}
        inert={state !== "focus"}
      >
        {shown.map((id, i) => {
          const a = city.agents[id]!,
            seat = plan.seats[i]!;
          const doing = VISUALS[visualState(city, id)] ?? VISUALS.idle!;
          const on = state === "focus" && turned === id;
          return (
            <li
              key={id}
              className={`desk${on ? " turned" : ""}`}
              style={{ left: seat.x * scale, top: (seat.y + 1) * scale, zIndex: seat.depth }}
            >
              <button
                type="button"
                className="agent"
                onClick={() => onAgent(id)}
                aria-pressed={on}
                aria-label={`${a.role}${a.kind === "manager" ? " (manager)" : ""}, ${doing.label.toLowerCase()}, ${MODEL_NAME[a.model] ?? a.model}. Turn to face you and open their card.`}
              >
                <span
                  className="chair"
                  aria-hidden="true"
                  style={{ width: PERSON_W * scale, height: PERSON_H * scale }}
                >
                  <img className="back" src={personSprite(a, "back")} alt="" />
                  <img className="front" src={personSprite(a, "front")} alt="" />
                </span>
                <span className="tag pixel" aria-hidden="true">
                  {a.kind === "manager" ? "Manager" : a.role}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {state === "focus" && more > 0 ? <p className="officemore pixel">{`+${more} more on this floor`}</p> : null}
      {state === "focus" && !shown.length ? (
        <p className="officemore">Nobody is at a desk on this floor right now.</p>
      ) : null}
    </div>
  );
}
