// Visiting a building (decision 166): from the City map to the street in front of a department's tower, then
// up into the floor of one of its projects. A project here is a piece of work the department has open: a job at
// the top of its tree in the city's tickets, with the department's manager and every worker on a part of it.
import { CORE, plainText, ticketWords, type CityState, type CityTicket } from "../city/city-state.js";

export interface VisitProject {
  id: string;
  title: string;
  status: string;
  /** The floor it is on: the lobby is floor 1, projects start at 2, oldest lowest. */
  floor: number;
  /** Who sits on that floor: the manager first, then the workers. */
  agents: string[];
}

export function deptProjects(city: CityState, dept: string): VisitProject[] {
  const all = Object.values(city.tickets);
  const mine = all.filter((t) => t.department === dept);
  const ids = new Set(mine.map((t) => t.id));
  const roots = mine
    .filter((t) => !t.parent_id || !ids.has(t.parent_id))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  const manager = city.departments[dept]?.manager_id;
  return roots.map((root, i) => {
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
    return {
      id: root.id,
      title: plainText(root.goal, 80).short,
      status: ticketWords(root.status),
      floor: i + 2,
      agents,
    };
  });
}

/** `#/city/visit/<dept>[/<project>]` → what to show. */
export function visitOf(slug: string | null): { dept: string; project: string | null } | null {
  if (!slug?.startsWith("visit/")) return null;
  const [dept, project] = slug.slice(6).split("/");
  return dept ? { dept, project: project || null } : null;
}
export const visitHash = (dept: string, project?: string | null) =>
  `/city/visit/${encodeURIComponent(dept)}${project ? `/${encodeURIComponent(project)}` : ""}`;
