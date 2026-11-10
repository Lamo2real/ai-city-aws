// The city the building-visit tests walk into (decision 166), shared by visit.spec.ts and phone.spec.ts.
import { baseSnapshot } from "./mock.ts";

// Application with two projects (one with three workers), Sales with none.
export function visitSnapshot() {
  const snap = baseSnapshot() as Omit<ReturnType<typeof baseSnapshot>, "departments" | "tickets"> & {
    agents: unknown[];
    departments: unknown[];
    tickets: unknown[];
  };
  snap.departments = ["Application", "Sales"].map((name) => ({
    name,
    mission: "x",
    manager_id: `mgr-${name.toLowerCase()}`,
    state: "active",
    created_at: "2026-11-01T00:00:00Z",
  }));
  for (const n of ["Application", "Sales"])
    snap.agents.push({
      id: `mgr-${n.toLowerCase()}`,
      kind: "manager",
      role: `${n} Manager`,
      department: n,
      model: "fable-5-2",
      parent: "orchestrator",
      state: "active",
    });
  const worker = (k: string, role: string, ticket: string) => ({
    id: `wkr-app-${k}`,
    kind: "worker",
    role,
    department: "Application",
    model: "opus-5-5",
    parent: "mgr-application",
    state: "active",
    worker_state: "working",
    ticket_id: ticket,
  });
  snap.agents.push(
    worker("a", "JavaScript developer", "t-2a"),
    worker("b", "Designer", "t-2b"),
    worker("c", "Tester", "t-2c"),
    worker("d", "Backend developer", "t-3a"),
  );
  const ticket = (id: string, goal: string, to: string, parent: string | null, at: string) => ({
    id,
    kind: "task",
    goal,
    from: parent ? "mgr-application" : "orchestrator",
    to,
    status: "in_progress",
    department: "Application",
    parent_id: parent,
    created_at: at,
  });
  snap.tickets = [
    ticket("t-1", "Build the booking page for the dentist", "mgr-application", null, "2026-11-10T08:00:00Z"),
    ticket("t-2a", "The page", "wkr-app-a", "t-1", "2026-11-10T08:01:00Z"),
    ticket("t-2b", "The look", "wkr-app-b", "t-1", "2026-11-10T08:01:00Z"),
    ticket("t-2c", "The tests", "wkr-app-c", "t-1", "2026-11-10T08:01:00Z"),
    ticket("t-3", "Fix the login bug in the customer portal", "mgr-application", null, "2026-11-10T09:00:00Z"),
    ticket("t-3a", "The fix", "wkr-app-d", "t-3", "2026-11-10T09:01:00Z"),
  ];
  return snap;
}
