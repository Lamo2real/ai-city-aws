// Inside a building (decision 166). From the map, a department's tower opens here as a cutaway seen from above
// at an angle (isometric, never first person): its floors stacked, one per project. Picking a project brings its
// floor into focus and fades the others to a tenth, so the eye stays on that floor: the workers
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
import { FLOOR_SEATS, deptProjects, type VisitFloor, type VisitProject } from "../lib/visit.ts";

export function CityVisit({
  dept,
  project,
  part,
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
  /** Which of the project's floors ("a", "b"…); none is its top floor. */
  part: string | null;
  city: CityState;
  /** The tower's slot on the map, so the colours match. */
  slot: number;
  /** The agent whose card is open: their chair is turned to you. */
  turned: string | null;
  /** Go to a project (its top floor), or to one of its floors. */
  onPick: (project: string, part?: string) => void;
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
  // Every floor with a project on it, lowest first; the one in focus is the picked project's top floor unless
  // the address names another.
  const levels = useMemo(() => projects.flatMap((p) => p.parts.map((f) => ({ p, f }))), [projects]);
  const here = chosen ? (chosen.parts.find((f) => f.part === part) ?? chosen.parts.at(-1)!) : null;
  const at = levels.findIndex((l) => l.f === here);
  // Up and down through the floors that have people on them (scroll, the arrow keys, the two buttons).
  const step = (dir: 1 | -1) => {
    const manned = levels.map((l, i) => ({ l, i })).filter((x) => x.l.f.agents.length || x.i === at);
    if (!manned.length) return null;
    if (at < 0) return dir > 0 ? manned[0]!.l : manned.at(-1)!.l;
    return manned[manned.findIndex((x) => x.i === at) + dir]?.l ?? null;
  };
  const up = step(1),
    down = step(-1);
  const move = useRef<(dir: 1 | -1) => void>(() => {});
  move.current = (dir) => {
    const to = dir > 0 ? up : down;
    if (to) onPick(to.p.id, to.f.part);
  };

  // Esc goes one step out, like Back; not while an agent's card is open (Esc closes the card first).
  const back = useRef(onBack);
  back.current = onBack;
  const card = useRef(turned);
  card.current = turned;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.defaultPrevented || card.current) return;
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        move.current(e.key === "ArrowUp" ? 1 : -1);
        return;
      }
      if (e.key !== "Escape") return;
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
  // The wheel (or two fingers on a trackpad) over the building goes a floor at a time, not faster than the move.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let sum = 0,
      last = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now - last < 450) return;
      sum += e.deltaY;
      if (Math.abs(sum) < 40) return;
      move.current(sum < 0 ? 1 : -1);
      sum = 0;
      last = now;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const wide = size.w >= 800;
  const cols = wide ? 4 : 2;
  const plan = useMemo(() => floorPlan(cols, FLOOR_SEATS / cols), [cols]); // eight desks, on any screen
  // The room's free space: beside the project list on a wide screen, above it on a phone.
  const area = wide
    ? { x: 12, y: 78, w: size.w - 376, h: size.h - 90 }
    : { x: 8, y: 140, w: size.w - 16, h: (phase === "floor" ? size.h - 12 : size.h * 0.56) - 140 };
  const scale = Math.max(0.5, Math.min(3, Math.floor(Math.min(area.w / plan.W, area.h / plan.H) * 20) / 20));
  // The whole tower: the lobby, the projects' floors, two storeys above. Only a project's floor can be in focus;
  // the rest is the building's shell, always faint.
  type Level = { p: VisitProject; f: VisitFloor } | "shell" | null;
  const floors: Level[] = ["shell", ...(levels.length ? levels : [null]), "shell", "shell"];
  const top = (i: number) => (floors.length - 1 - i) * FLOOR_PITCH * scale; // the lobby at the bottom
  const focus = at < 0 ? -1 : at + 1;
  const stackH = top(0) + plan.H * scale;
  // With no floor in focus the whole stack is in view, smaller if it has to be.
  const zoom = focus >= 0 ? 1 : Math.min(1, area.h / stackH);
  const centre = focus >= 0 ? top(focus) + (plan.H * scale) / 2 : stackH / 2;
  const shift = {
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
          <div className="floorstack" style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${zoom})` }}>
            {floors.map((f, i) => {
              const l = f === "shell" ? null : f;
              return (
                <Floor
                  key={l ? `${l.p.id}:${l.f.part}` : `shell${i}`}
                  plan={plan}
                  scale={scale}
                  top={top(i)}
                  project={l?.p ?? null}
                  level={l?.f ?? null}
                  dept={dept}
                  city={city}
                  look={look}
                  state={f === "shell" ? "faded" : !l ? "empty" : focus < 0 ? "open" : focus === i ? "focus" : "faded"}
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
          <small>{here ? `Floor ${here.floor} · ${here.label}` : "All floors"}</small>
        </h2>
        {chosen ? (
          <>
            <span className="visitsteps">
              <button type="button" aria-label="Floor above" disabled={!up} onClick={() => move.current(1)}>
                ▲
              </button>
              <button type="button" aria-label="Floor below" disabled={!down} onClick={() => move.current(-1)}>
                ▼
              </button>
            </span>
            <button type="button" className="visitback" onClick={onBack}>
              All floors
            </button>
          </>
        ) : null}
      </header>
      {/* Hidden while an agent's card is open: the card sits in the same corner, and the list showed through it. */}
      <nav
        className={`visitpick cityui${turned ? " behind" : ""}`}
        aria-label={`Projects in ${dept}`}
        aria-hidden={turned ? true : undefined}
        inert={turned ? true : undefined}
      >
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
                    <small>{`${p.status} · ${p.agents.length === 1 ? "1 agent" : `${p.agents.length} agents`}${p.parts.length > 1 ? ` · ${p.parts.length} floors` : ""}`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mute">{`Nobody in ${dept} is working on a project right now. Ask VAIC for something and it shows up here.`}</p>
        )}
        {levels.length > 1 ? <p className="mute visithint">Scroll or press ↑ ↓ to go from floor to floor.</p> : null}
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
  level,
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
  /** Which of the project's floors this is, and who sits on it. */
  level: VisitFloor | null;
  dept: string;
  city: CityState;
  look: { wall: string; shade: string };
  /** In focus, faded behind the floor in focus, one of all the floors (none picked), or an empty building. */
  state: "focus" | "faded" | "open" | "empty";
  turned: string | null;
  onPick: (project: string, part?: string) => void;
  onAgent: (id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useMemo(
    () => (level?.agents ?? []).slice(0, plan.seats.length).filter((id) => city.agents[id]),
    [level, plan, city.agents],
  );
  const seed = `${dept}:${project ? `${project.id}:${level?.part}` : top}`;
  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (g) paintFloor(g, plan, { seed, people: shown.length, wall: look.wall, wall2: look.shade });
  }, [plan, seed, shown.length, look.wall, look.shade]);
  return (
    // A floor that is not in focus is a picture you can click to pick it; the project list does the same by keyboard.
    <div
      className={`floor floor-${state}`}
      style={{ top, width: plan.W * scale, height: plan.H * scale }}
      onClick={state === "open" && project ? () => onPick(project.id, level?.part) : undefined}
      aria-hidden={state === "focus" ? undefined : true}
    >
      <canvas ref={canvas} width={plan.W} height={plan.H} aria-hidden="true" />
      {project ? (
        <span
          className="floortag pixel"
          aria-hidden="true"
          style={{ left: plan.corner.x * scale, top: plan.corner.y * scale }}
        >{`${level?.floor ?? project.floor}F`}</span>
      ) : null}
      <ul className="desks" aria-label={level ? `Who works on ${level.label}` : undefined} inert={state !== "focus"}>
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
      {state === "focus" && !shown.length ? (
        <p className="officemore">Nobody is at a desk on this floor right now.</p>
      ) : null}
    </div>
  );
}
