// What really needs the owner: the questions and approvals that can still be answered, grouped by the job they
// belong to, with who asks in plain words. One source for the badge, the City's box and the Needs you screen,
// so the number is the same everywhere.
//   An item tied to a part that is no longer open (finished, stopped, or unknown here) is hidden: the server
//   withdraws those too, and nobody can act on them.
//   Items tied to no job (an app to publish, a connector to add) stay, under "Other things".
import { plainText, plainWho, type CityApproval, type CityQuestion, type CityState } from "../city/city-state.js";

export interface Job {
  id: string;
  name: string;
}
export type Need =
  | { kind: "question"; id: string; at: string; who: string; q: CityQuestion; job: Job | null }
  | { kind: "approval"; id: string; at: string; who: string; a: CityApproval; job: Job | null };

const open = (c: CityState, id: string) => c.tickets[id] ?? c.parked[id];

/** The job a part belongs to (its top-most open ancestor), null for no job, "gone" when the part is closed. */
function jobOf(c: CityState, ticketId: string | undefined): Job | null | "gone" {
  if (!ticketId) return null;
  let t = open(c, ticketId);
  if (!t) return "gone";
  for (let i = 0; i < 20 && t.parent_id; i++) {
    const up = open(c, t.parent_id);
    if (!up) break;
    t = up;
  }
  const name = plainText(t.owner_words || t.goal, 60).short;
  return { id: t.id, name: name.charAt(0).toUpperCase() + name.slice(1) };
}

export function needs(c: CityState): Need[] {
  const out: Need[] = [];
  for (const q of Object.values(c.questions)) {
    const job = jobOf(c, q.ticket_id);
    if (job !== "gone")
      out.push({ kind: "question", id: q.id, at: q.created_at, who: plainWho(c, q.asked_by), q, job });
  }
  for (const a of Object.values(c.approvals)) {
    const job = jobOf(c, a.ticket_id);
    if (job === "gone") continue;
    const app = a.requested_by?.startsWith("app:") ? c.apps?.[a.requested_by.slice(4)] : undefined;
    const who = a.requested_by?.startsWith("app:")
      ? app?.title
        ? `${plainText(app.title, 40).short} (an app)`
        : "One of your apps"
      : plainWho(c, a.agent);
    out.push({ kind: "approval", id: a.id, at: (a as { created_at?: string }).created_at ?? "", who, a, job });
  }
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

export const needsCount = (c: CityState) => needs(c).length;

/** Needs grouped by job, the group with the oldest item first; items without a job last. */
export function byJob(list: Need[]): Array<{ job: Job | null; items: Need[] }> {
  const groups = new Map<string, { job: Job | null; items: Need[] }>();
  for (const n of list) {
    const key = n.job?.id ?? "";
    if (!groups.has(key)) groups.set(key, { job: n.job, items: [] });
    groups.get(key)!.items.push(n);
  }
  return [...groups.values()].sort((a, b) => (a.job ? 0 : 1) - (b.job ? 0 : 1));
}

/** "3 things need you", "One thing needs you". */
export const needsWords = (n: number) => (n === 1 ? "1 thing needs you" : `${n} things need you`);
