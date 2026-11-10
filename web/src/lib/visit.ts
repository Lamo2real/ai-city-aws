// Visiting a building (decisions 166, 171, 172): from the City map into a department's tower and onto the floors
// of one of its projects. A project here is a piece of work the department has open: a job at the top of its tree
// in the city's tickets, with the department's manager and every worker on a part of it. A floor seats eight and
// belongs to one project; a bigger team continues on the floors above (1a, 1b, 1c…).
import { CORE, plainText, ticketWords, type CityState, type CityTicket } from "../city/city-state.js";

export interface VisitProject {
  id: string;
  title: string;
  status: string;
  /** Its top floor: the lobby is floor 1, projects start at 2, oldest lowest. */
  floor: number;
  /** Everyone on it: the manager first, then the workers. */
  agents: string[];
  /** Its floors, lowest first: eight people a floor, never shared with another project. */
  parts: VisitFloor[];
}
export interface VisitFloor {
  /** "a" for a project's first floor, "b" for the next one up, and so on. */
  part: string;
  floor: number;
  /** The floor's name: the project, plus "1a", "1b"… when it has more than one floor. */
  label: string;
  agents: string[];
}
export const FLOOR_SEATS = 8;
const letter = (k: number) => (k < 26 ? String.fromCharCode(97 + k) : `z${k - 25}`);

export function deptProjects(city: CityState, dept: string): VisitProject[] {
  const all = Object.values(city.tickets);
  const mine = all.filter((t) => t.department === dept);
  const ids = new Set(mine.map((t) => t.id));
  const roots = mine
    .filter((t) => !t.parent_id || !ids.has(t.parent_id))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  const manager = city.departments[dept]?.manager_id;
  let next = 2; // the lobby is floor 1
  return roots.map((root) => {
    const tree: CityTicket[] = [root];
    for (let k = 0; k < tree.length; k++) for (const t of all) if (t.parent_id === tree[k]!.id) tree.push(t);
    const inTree = new Set(tree.map((t) => t.id));
    const people = [
      manager,
      ...tree.map((t) => t.to),
      ...Object.values(city.agents)
        .filter((a) => a.ticket_id && inTree.has(a.ticket_id))
        .map((a) => a.id),
    ];
    const agents = [...new Set(people)].filter((id): id is string => {
      const a = id ? city.agents[id] : undefined;
      return !!a && !CORE.has(a.id) && a.state !== "retired" && a.kind !== "specialist";
    });
    agents.sort((a, b) => Number(city.agents[b]!.kind === "manager") - Number(city.agents[a]!.kind === "manager"));
    const title = plainText(root.goal, 80).short;
    const count = Math.max(1, Math.ceil(agents.length / FLOOR_SEATS));
    const parts = Array.from({ length: count }, (_, k) => ({
      part: letter(k),
      floor: next + k,
      label: count > 1 ? `${title} · 1${letter(k)}` : title,
      agents: agents.slice(k * FLOOR_SEATS, (k + 1) * FLOOR_SEATS),
    }));
    next += count;
    return { id: root.id, title, status: ticketWords(root.status), floor: next - 1, agents, parts };
  });
}

export interface Visit {
  dept: string;
  project: string | null;
  /** Which of the project's floors ("a", "b"…); none means its top floor. */
  part: string | null;
}
/** `#/city/visit/<dept>[/<project>[/<part>]]` → what to show. */
export function visitOf(slug: string | null): Visit | null {
  if (!slug?.startsWith("visit/")) return null;
  const [dept, project, part] = slug.slice(6).split("/");
  return dept ? { dept, project: project || null, part: (project && part) || null } : null;
}
export const visitHash = (dept: string, project?: string | null, part?: string | null) =>
  `/city/visit/${encodeURIComponent(dept)}${project ? `/${encodeURIComponent(project)}${part ? `/${encodeURIComponent(part)}` : ""}` : ""}`;
