// Ported from the owner's Mac HUD (ai-city/jarvis/hud/city-state.js) and adapted to AI City on AWS:
// VAIC and the Orchestrator are the core; there is no Secretary or Reviewer; events and snapshots come
// from the AWS API and WebSocket. Pure functions, no DOM, unit-tested in Node.
// The City View's state: what the scene draws, as plain data. Pure functions, no DOM, no three.js,
// so the event → state step is unit-tested in Node. The scene reads this; it never reads the server.

export const MODEL_COLOR = { "haiku-5-5": "#ffd21e", "opus-5-5": "#3b82ff", "sonnet-5-5": "#2fd36b", "fable-5-2": "#a86bff" };
export const MODEL_NAME = { "haiku-5-5": "Haiku 5.5", "opus-5-5": "Opus 5.5", "sonnet-5-5": "Sonnet 5.5", "fable-5-2": "Fable 5.2" };
export const DEPT_COLOR = { HQ: "#3b82ff", IT: "#4cc9f0", App: "#ff7a45", Cloud: "#8ecae6", Marketing: "#f72585", Video: "#b5179e", Travel: "#06d6a0", other: "#9aa0a6" };
export const CORE = new Set(["ace", "orchestrator"]);
export const TOOL_PROP = [["ios|swift|app", "laptop"], ["video|film|camera", "camera"], ["market|ads|growth", "chart"], ["cloud|infra|terraform|devops", "wrench"], ["travel|flight|hotel", "ticket"], ["qa|test", "clipboard"], [".", "laptop"]];
export const FEED_MAX = 120;
// Every dollar figure in the HUD is this: a value at list prices, not money that moved.
export const COST_NOTE = "Estimate from token counts at list prices. The AWS bill is the truth.";
export const estUsd = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : `est. $${Number(v).toFixed(digits)}`);
const RECENT_MS = { done: 6000, review_fail: 20000, hired: 4000, retired: 4000 };

export function initialState(now = Date.now()) {
  return { agents: {}, activities: {}, tickets: {}, questions: {}, approvals: {}, departments: {}, reviews: {}, costs: {}, usage: null, spend: {}, caps: null, parked: {}, city: null, capHit: null, feed: [], recent: {}, apps: {}, now };
}

export const deptOf = (agent) => (CORE.has(agent.id) || agent.kind === "executive" ? "HQ" : agent.department || "other");
export const deptColor = (name) => DEPT_COLOR[name] ?? DEPT_COLOR.other;
export function propFor(agent) {
  if (agent.kind !== "worker") return null;
  const text = `${agent.role} ${agent.id} ${(agent.skills ?? []).join(" ")}`.toLowerCase();
  return TOOL_PROP.find(([re]) => new RegExp(re).test(text))[1];
}

// The same key the runtime files a department under (departmentKey in city/src/policy.ts).
const keyOf = (name) => String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
// An agent carries the spelling of the department's registry entry, so one department is one building.
function filed(departments, a) {
  const d = a.department && Object.values(departments).find((x) => keyOf(x.name) === keyOf(a.department));
  return d && d.name !== a.department ? { ...a, department: d.name } : a;
}

function touch(state, department, now) {
  if (department === "HQ" || state.departments[department]) return state.departments;
  return { ...state.departments, [department]: { name: department, builtAt: now } };
}

function feed(state, text, kind, now) {
  return [{ at: now, text, kind }, ...state.feed].slice(0, FEED_MAX);
}

export function applySnapshot(state, snap, now = Date.now()) {
  const next = { ...initialState(now), feed: state.feed };
  // The registry says which departments exist. Only a snapshot from before the registry (no `departments`) falls back to the agents.
  const listed = Array.isArray(snap.departments);
  for (const d of listed ? snap.departments : []) {
    const born = Date.parse(d.created_at ?? "");
    if (d.state !== "deleted") next.departments[d.name] = { ...d, builtAt: Math.min(now - 60000, Number.isNaN(born) ? Infinity : born) }; // already built: no construction animation
  }
  for (const a of snap.agents ?? []) {
    next.agents[a.id] = filed(next.departments, a);
    if (!listed) next.departments = touch(next, deptOf(a), now - 60000);
  }
  // Saved specialists who are not hired right now live in the houses.
  for (const sp of snap.specialists ?? []) {
    const id = `spec-${sp.id}`;
    if (!next.agents[id]) next.agents[id] = { id, kind: "specialist", role: sp.specialty, department: sp.department, model: "opus-5-5", parent: null, state: "retired", worker_state: "released", last_active_at: sp.created_at };
  }
  next.activities = snap.activities ?? {};
  for (const t of snap.tickets ?? []) next.tickets[t.id] = t;
  for (const t of snap.parked ?? []) next.parked[t.id] = t;
  next.city = snap.city ?? null;
  next.region = snap.region ?? null;
  for (const q of snap.questions ?? []) next.questions[q.id] = q;
  for (const a of snap.approvals ?? []) next.approvals[a.id] = a;
  for (const a of snap.apps ?? []) if (a?.app_id) next.apps[a.app_id] = a;
  next.usage = snap.usage ?? null;
  next.spend = snap.spend ?? {};
  next.caps = snap.caps ?? null; // the limits the server enforces; null when the server did not send them
  return next;
}

// What only a snapshot carries (the gate's counters, parked tickets, spend), taken without rebuilding the scene's state.
export function applyLive(state, snap, now = Date.now()) {
  const parked = {};
  for (const t of snap.parked ?? []) parked[t.id] = t;
  return { ...state, now, parked, city: snap.city ?? state.city, usage: snap.usage ?? state.usage, spend: snap.spend ?? state.spend };
}

// A worker's move that is worth a line. hired/assigned/working/idle already show as hire and ticket lines.
const WORKER_LINE = { review: "worker", completed: "done", released: "worker", blocked: "fail", failed: "fail", paused: "worker", cancelled: "worker" };
const asked = (state, event, now) => ({ ...state, now, questions: { ...state.questions, [event.question.id]: event.question }, feed: feed(state, `${event.question.path} asks: ${event.question.text}`, "question", now) });

// One event in, a new state out. Unknown events change nothing. A line it adds to the feed also carries the
// event's story in plain words (or none, for bookkeeping nobody needs to read), which the Activity panel shows.
export function reduce(state, event, now = Date.now()) {
  const next = reduceEvent(state, event, now);
  if (next.feed === state.feed || !next.feed.length) return next;
  const story = storyOf(event, state);
  return story ? { ...next, feed: [{ ...next.feed[0], story }, ...next.feed.slice(1)] } : next;
}

const an = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
// "Writer" → "writer" inside a sentence; a name like "JavaScript developer" or "QA tester" keeps its capitals.
const inSentence = (role) => (/^[A-Z][a-z]+(\s|$)/.test(role) ? role.charAt(0).toLowerCase() + role.slice(1) : role);
const shortGoal = (text) => plainText(text, 60).short;

/** Who someone is, in words the owner knows: never an id. */
export function plainWho(state, id) {
  if (id === "ace") return "VAIC";
  if (id === "orchestrator") return "The planner";
  const a = state.agents?.[id];
  if (!a) return "Someone on the team";
  if (a.kind === "manager") return `The ${deptOf(a)} manager`;
  if (a.kind === "executive") return `The ${a.role}`;
  return a.role ? `The ${inSentence(a.role)} in ${deptOf(a)}` : `A worker in ${deptOf(a)}`;
}

// What happened, for the owner: `one` for a single event, `many` (with {n}) when a burst of the same `key` is
// grouped into one line. Null: bookkeeping (status moves, colleagues talking, retries) that stays off the panel.
function storyOf(event, s) {
  switch (event.type) {
    case "agent.hired": {
      const a = event.agent, d = deptOf(a);
      if (a.kind === "manager") return { key: `mgr:${d}`, one: `${d} got a manager` };
      if (a.kind !== "worker") return null;
      const role = a.role ? inSentence(a.role) : "worker";
      return { key: `hire:${d}`, one: `${d} hired ${an(role)} ${role}`, many: `${d} hired {n} workers` };
    }
    case "executive.office":
      // Decision 140: called in to HQ to advise. Going home again stays off the panel.
      return event.at_hq ? { key: `exec:${event.id}`, one: `The ${event.agent?.role ?? "executive"} came in to HQ to advise` } : null;
    case "agent.retired": {
      const a = s.agents[event.id];
      if (!a || a.kind !== "worker") return null;
      const d = deptOf(a);
      return { key: `home:${d}`, one: `A worker in ${d} went home`, many: `{n} workers in ${d} went home` };
    }
    case "ticket.status": {
      const t = event.ticket, d = t.department || "The team";
      const job = t.kind === "task" || (!t.parent_id && t.from === "ace");
      if (event.previous === null || event.previous === undefined)
        return job ? { key: `job:${t.id}`, one: `New job: ${shortGoal(t.goal)}` } : { key: `start:${d}`, one: `${d} started a part`, many: `${d} started {n} parts` };
      if (t.status === "done") return job ? { key: `fin:${t.id}`, one: `Job finished: ${shortGoal(t.goal)}` } : { key: `done:${d}`, one: `${d} finished a part`, many: `${d} finished {n} parts` };
      if (t.status === "failed") return { key: `failed:${d}`, one: `A part did not finish in ${d}`, many: `{n} parts did not finish in ${d}` };
      if (t.status === "cancelled") return job ? { key: `stop:${t.id}`, one: `Job stopped: ${shortGoal(t.goal)}` } : { key: "stopped", one: "A part was stopped", many: "{n} parts were stopped" };
      return null;
    }
    case "question.asked":
      return { key: "ask", one: `${plainWho(s, event.question.asked_by)} has a question for you`, many: "{n} questions for you" };
    case "question.answered":
      return { key: "answered", one: "A question was answered", many: "{n} questions were answered" };
    case "review.result":
      return event.verdict === "PASS" ? { key: "passed", one: "A part passed its check", many: "{n} parts passed their check" } : { key: "fix", one: "A part needs fixing after its check", many: "{n} parts need fixing after their check" };
    case "result":
      return { key: `result:${event.summary}`, one: `Finished: ${shortGoal(event.summary)}` };
    case "approval.requested":
      return event.kind === "app.publish" ? { key: "app-ready", one: "A new app is ready to try", many: "{n} new apps are ready to try" } : { key: "ok", one: "Something needs your OK", many: "{n} things need your OK" };
    case "approval.decided":
      return { key: `decided:${event.id}`, one: event.approved ? "You said yes" : "You said no" };
    case "app.published":
      return { key: `app:${event.app_id}`, one: `New app: ${String(event.title ?? "").slice(0, 40)}` };
    case "app.updated":
      return { key: `appv:${event.app?.app_id}`, one: `${String(event.app?.title ?? "An app").slice(0, 40)} has a new version` };
    case "app.removed":
      return { key: `appx:${event.app_id}`, one: "An app was removed" };
    case "spend.cap_reached":
      return { key: "cap", one: "The spending limit was reached; new work waits" };
    case "department.created":
      return { key: `dept:${event.name}`, one: `New department: ${event.name}` };
    case "department.demolished":
      return { key: `demolished:${event.name}`, one: `${event.name} was demolished` };
    case "tickets.parked":
      return { key: "parked", one: `${event.ids?.length ?? 0} old jobs were put aside for you` };
    case "turn.failed":
      return event.retrying ? null : { key: "went-wrong", one: "A step went wrong", many: "{n} steps went wrong" };
    case "instruction":
      return { key: `told:${event.to}`, one: `You sent a note to ${plainWho(s, event.to).replace(/^The /, "the ")}` };
    default:
      return null;
  }
}

/** The Activity panel: plain lines, newest first; a burst of the same thing within five minutes is one line. */
export function stories(feedLines, limit = 8) {
  const out = [];
  for (const f of feedLines) {
    const st = f.story;
    if (!st) continue;
    const last = out[out.length - 1];
    if (last && !st.many && last.key === st.key && last.oldest - f.at <= 5 * 60_000) continue; // the same thing twice
    if (last && st.many && last.key === st.key && last.oldest - f.at <= 5 * 60_000) {
      last.n += 1;
      last.oldest = f.at;
      last.text = st.many.replace("{n}", String(last.n));
      continue;
    }
    out.push({ key: st.key, at: f.at, oldest: f.at, n: 1, text: st.one, kind: f.kind });
  }
  return out.slice(0, limit).map(({ at, text, kind }) => ({ at, text, kind }));
}

function reduceEvent(state, event, now) {
  switch (event.type) {
    case "executive.office": {
      // An executive (decision 140) was called in to HQ (state active) or went home (dormant). Never a worker.
      const a = event.agent ?? state.agents[event.id];
      if (!a) return state;
      return { ...state, now, agents: { ...state.agents, [a.id]: { ...a, state: event.at_hq ? "active" : "dormant" } } };
    }
    case "agent.hired": {
      const a = filed(state.departments, event.agent);
      return { ...state, now, agents: { ...state.agents, [a.id]: a }, departments: touch(state, deptOf(a), now), recent: { ...state.recent, [a.id]: { kind: "hired", at: now } }, feed: feed(state, `${a.role} ${event.revived ? "is back" : "hired"} in ${deptOf(a)}`, "hire", now) };
    }
    case "agent.retired": {
      const a = state.agents[event.id];
      if (!a) return state;
      return { ...state, now, agents: { ...state.agents, [a.id]: { ...a, state: "retired" } }, recent: { ...state.recent, [a.id]: { ...state.recent[a.id], kind: "retired", at: now } }, feed: feed(state, `${a.role} ${a.worker_state === "released" ? "released" : "retired"}`, "retire", now) };
    }
    case "ticket.status": {
      const t = event.ticket;
      const tickets = { ...state.tickets }, parked = { ...state.parked };
      const terminal = ["done", "failed", "cancelled"].includes(t.status);
      delete tickets[t.id]; delete parked[t.id];
      if (t.status === "parked") parked[t.id] = t; else if (!terminal) tickets[t.id] = t;
      const recent = terminal ? { ...state.recent, [t.to]: { kind: t.status, at: now, ticket: t.id } } : state.recent;
      const text = event.previous === null ? `${t.to} got a ticket from ${t.from}: ${t.goal.slice(0, 60)}` : `${t.to}: ${event.previous} → ${t.status}`;
      return { ...state, now, tickets, parked, recent, feed: feed(state, text, t.status, now) };
    }
    case "question.asked":
      return state.questions[event.question.id] ? state : asked(state, event, now);
    case "question.answered": {
      const questions = { ...state.questions };
      delete questions[event.id];
      return { ...state, now, questions, feed: feed(state, `${event.answered_by} answered: ${event.answer.slice(0, 60)}`, "answer", now) };
    }
    case "review.started": {
      const t = state.tickets[event.ticket_id];
      return { ...state, now, reviews: { ...state.reviews, [event.ticket_id]: { round: event.round, verdict: null, at: now, agent: t?.to ?? null } }, feed: feed(state, `Inspector at ${t?.to ?? event.ticket_id}'s door (round ${event.round})`, "review", now) };
    }
    case "review.result": {
      const prev = state.reviews[event.ticket_id];
      return { ...state, now, reviews: { ...state.reviews, [event.ticket_id]: { ...prev, round: event.round, verdict: event.verdict, at: now } }, feed: feed(state, `Review ${event.verdict}: ${event.summary.slice(0, 60)}`, event.verdict === "PASS" ? "pass" : "fail", now) };
    }
    case "cost.update": {
      const c = state.costs[event.agent] ?? { usd: 0, tokens: 0 };
      return { ...state, now, usage: event.today, costs: { ...state.costs, [event.agent]: { usd: c.usd + event.usd, tokens: c.tokens + event.tokens } } };
    }
    case "result":
      return { ...state, now, feed: feed(state, `Done: ${event.summary.slice(0, 70)}`, "result", now) };
    case "worker.state": {
      const a = state.agents[event.id];
      if (!a) return state;
      const kind = WORKER_LINE[event.state];
      return { ...state, now, agents: { ...state.agents, [a.id]: { ...a, worker_state: event.state } }, feed: kind ? feed(state, `${a.id}: ${event.previous ?? "new"} → ${event.state}`, kind, now) : state.feed };
    }
    case "activity": {
      const { id, activity, detail, at } = event;
      return { ...state, now, activities: { ...state.activities, [id]: { activity, detail, at } } };
    }
    case "signoff.result":
      return { ...state, now, feed: feed(state, `Orchestrator sign-off ${event.verdict}: ${event.summary.slice(0, 60)}`, event.verdict === "PASS" ? "pass" : "fail", now) };
    case "instruction":
      return { ...state, now, feed: feed(state, `You told ${event.to}: ${event.text.slice(0, 60)}`, "answer", now) };
    case "approval.requested":
      return { ...state, now, approvals: { ...state.approvals, [event.id]: event }, feed: feed(state, event.kind === "app.publish" ? `A new app is ready for you to try: ${String(event.title ?? "").slice(0, 40)}` : `${event.agent} needs your approval: ${String(event.action ?? "").slice(0, 60)}`, "question", now) };
    case "app.draft":
      return { ...state, now, feed: feed(state, event.status === "rejected" ? `App ${String(event.title ?? "").slice(0, 40)} sent back: ${String(event.reason ?? "").slice(0, 60)}` : `App ${String(event.title ?? "").slice(0, 40)} built, checked: ${event.status}`, event.status === "rejected" ? "fail" : "worker", now) };
    case "app.published": {
      if (!event.app_id) return state;
      const app = { ...state.apps[event.app_id], ...event };
      delete app.type; delete app.at;
      return { ...state, now, apps: { ...state.apps, [event.app_id]: app }, feed: feed(state, `New app under Apps: ${String(event.title ?? "").slice(0, 40)}`, "pass", now) };
    }
    case "app.updated": {
      const a = event.app;
      if (!a?.app_id || !state.apps[a.app_id]) return state; // an app this HUD doesn't have: GET /apps brings it
      const was = state.apps[a.app_id];
      const next = { ...state, now, apps: { ...state.apps, [a.app_id]: { ...was, ...a } } };
      if (a.version === undefined || a.version === (was.version ?? 1)) return next;
      return { ...next, feed: feed(state, `${String(a.title ?? was.title ?? "An app").slice(0, 40)} is now version ${Number(a.version)}`, "pass", now) };
    }
    case "app.removed": {
      const gone = state.apps[event.app_id];
      if (!gone) return state; // already gone (the HUD removes it at once; the event follows)
      const apps = { ...state.apps };
      delete apps[event.app_id];
      return { ...state, now, apps, feed: feed(state, `App removed: ${String(gone.title ?? event.slug ?? "").slice(0, 40)}`, "worker", now) };
    }
    case "question.withdrawn": {
      if (!state.questions[event.id]) return state;
      const questions = { ...state.questions };
      delete questions[event.id];
      return { ...state, now, questions };
    }
    case "approval.withdrawn": {
      if (!state.approvals[event.id]) return state;
      const approvals = { ...state.approvals };
      delete approvals[event.id];
      return { ...state, now, approvals };
    }
    case "approval.decided": {
      const approvals = { ...state.approvals };
      delete approvals[event.id];
      return { ...state, now, approvals, feed: feed(state, event.approved ? "You approved an action" : "You refused an action", event.approved ? "pass" : "fail", now) };
    }
    case "spend.cap_reached":
      return { ...state, now, capHit: event, feed: feed(state, `Spend cap reached: ${event.cap.replace(/_/g, " ")} ($${event.limit})`, "fail", now) };
    case "worker.merge_waiting": {
      const a = state.agents[event.id];
      if (!a) return state;
      return { ...state, now, agents: { ...state.agents, [a.id]: { ...a, awaiting_merge: { branch: event.branch, since: new Date(now).toISOString() } } }, feed: feed(state, `${a.id} stays at its desk until ${event.branch} is merged`, "worker", now) };
    }
    case "worker.merged": {
      const a = state.agents[event.id];
      if (!a) return state;
      return { ...state, now, agents: { ...state.agents, [a.id]: { ...a, awaiting_merge: null } }, feed: feed(state, `${event.branch} is settled; ${a.id} can leave its desk`, "done", now) };
    }
    case "ace.visit":
      return { ...state, now, feed: feed(state, `VAIC ${event.kind === "ask" ? "asks" : "checks in with"} ${event.to}`, "worker", now) };
    case "colleague.ask":
      return { ...state, now, feed: feed(state, event.refused ? `${event.from} and ${event.to} have asked each other too much; ${event.from} was told to stop` : `${event.from} asks ${event.to}: ${event.question.slice(0, 60)}`, event.refused ? "fail" : "worker", now) };
    case "colleague.answer":
      return { ...state, now, feed: feed(state, event.answered_by === "ledger" ? `${event.from} got ${event.to}'s record, not an answer` : `${event.to} answers ${event.from}: ${event.answer.slice(0, 60)}`, "worker", now) };
    case "department.created": {
      const was = state.departments[event.name];
      if (was && was.state !== "demolished") return state;
      // A rebuilt department goes back up on its old lot; a new one takes the next free lot.
      return { ...state, now, departments: { ...state.departments, [event.name]: { name: event.name, mission: event.mission, manager_id: event.manager_id, state: "active", worker_model: event.worker_model ?? null, builtAt: was?.builtAt ?? now, rebuiltAt: now } }, feed: feed(state, `Department ${event.name} created`, "department", now) };
    }
    case "department.demolished": {
      // The record stays until the next snapshot so the lot keeps its place and the towers beside it don't move
      // (decision 134); the scene plays the demolition over it.
      const was = state.departments[event.name];
      if (!was || was.state === "demolished") return state;
      return { ...state, now, departments: { ...state.departments, [event.name]: { ...was, state: "demolished", demolishedAt: now } }, feed: feed(state, `Department ${event.name} demolished`, "department", now) };
    }
    case "department.updated": {
      const d = event.department;
      const oldKey = event.previous_key ?? keyOf(d.name);
      const old = Object.values(state.departments).find((x) => keyOf(x.name) === oldKey);
      const departments = { ...state.departments };
      if (old) delete departments[old.name];
      if (d.state !== "deleted") departments[d.name] = { ...d, builtAt: old?.builtAt ?? now };
      // A rename moves its members in the ledger without an event of its own.
      const agents = old && old.name !== d.name ? Object.fromEntries(Object.entries(state.agents).map(([id, a]) => [id, a.department && keyOf(a.department) === oldKey ? { ...a, department: d.name } : a])) : state.agents;
      const text = !old?.key ? `Department ${d.name} created` : old.name !== d.name ? `Department ${old.name} is now ${d.name}` : old.state !== d.state ? `Department ${d.name}: ${old.state} → ${d.state}` : `Department ${d.name} updated`;
      return { ...state, now, departments, agents, feed: feed(state, text, "department", now) };
    }
    case "tickets.parked": {
      const tickets = { ...state.tickets }, parked = { ...state.parked };
      for (const id of event.ids ?? []) if (tickets[id]) { parked[id] = { ...tickets[id], status: "parked" }; delete tickets[id]; }
      return { ...state, now, tickets, parked, feed: feed(state, `${event.ids?.length ?? 0} stale tickets parked; they wait for you`, "fail", now) };
    }
    case "turn.failed":
      return { ...state, now, feed: feed(state, `${event.agent || "A turn"} failed${event.retrying ? ", retrying" : ""}: ${String(event.error ?? "").slice(0, 80)}`, "fail", now) };
    default:
      return state;
  }
}

// What an agent is doing right now, for its animation.
export function agentStatus(state, id, now = state.now) {
  const a = state.agents[id];
  if (!a) return "unknown";
  if (a.state === "retired") return a.worker_state === "released" ? "released" : "retired";
  const mine = Object.values(state.tickets).filter((t) => t.to === id);
  const review = Object.values(state.reviews).find((r) => r.agent === id && r.verdict === "FAIL" && now - r.at < RECENT_MS.review_fail);
  if (review) return "review_fail";
  // A worker's lifecycle is what the runtime says it is; tickets only decide for agents without one.
  if (a.kind === "worker" && a.worker_state) return a.worker_state === "blocked" && mine.some((t) => t.status === "waiting_on_owner") ? "waiting_on_owner" : a.worker_state;
  if (mine.some((t) => t.status === "in_review")) return "in_review";
  if (mine.some((t) => t.status === "waiting_on_owner")) return "waiting_on_owner";
  const recent = state.recent[id];
  if (recent?.kind === "done" && now - recent.at < RECENT_MS.done) return "done";
  if (mine.some((t) => t.status === "in_progress" || t.status === "open")) return "working";
  return "idle";
}

export const departmentNames = (state) => Object.values(state.departments).sort((a, b) => a.builtAt - b.builtAt).map((d) => d.name);
// The towers standing (a demolished one keeps its lot until the next snapshot, but it is not a department any more).
export const standingDepartments = (state) => departmentNames(state).filter((n) => state.departments[n]?.state !== "demolished");

// ---------- Where each agent is. The whole game follows from these few rules. ----------
const hasOpenWork = (state, id) => Object.values(state.tickets).some((t) => t.to === id || t.from === id);

// Core: HQ. Anyone else is at its station while it has open work, is hired and not released, or waits for a merge. Otherwise home.
// `state.tickets` holds only open tickets: a parked one does nothing until the owner decides, so it keeps nobody at a desk.
export function placement(state, id) {
  const a = state.agents[id];
  if (!a) return null;
  if (a.kind === "core" || CORE.has(id)) return { place: "hq", dept: "HQ", why: "core" };
  if (a.kind === "specialist") return { place: "home", dept: deptOf(a), why: "saved specialist" };
  // The executives (decision 140): permanent, at home until the Orchestrator calls them in, at HQ while they advise.
  if (a.kind === "executive") return a.state === "active" ? { place: "hq", dept: "HQ", why: "called in" } : { place: "home", dept: "HQ", why: "off duty" };
  const dept = deptOf(a);
  if (hasOpenWork(state, id)) return { place: "station", dept, why: "ticket" };
  if (a.awaiting_merge) return { place: "station", dept, why: "merge" };
  if (a.state !== "retired" && a.worker_state !== "released") return { place: "station", dept, why: "hired" }; // managers too: an idle one stays in its window
  return { place: "home", dept, why: a.state === "retired" ? "released" : "off work" };
}

// A real retirement or release walks home, once per id. `walked` is the set of ids that already did; it is filled here,
// so a reconnect, a snapshot or a later move home never plays the walk again. Pure otherwise.
export function walksOut(state, id, walked) {
  const a = state.agents[id];
  if (!a || walked.has(id) || (a.state !== "retired" && a.worker_state !== "released")) return false;
  walked.add(id);
  return true;
}

// What the figure shows: a key of VISUALS, one for every activity the runtime reports and every lifecycle mark.
export function visualState(state, id, now = Date.now()) {
  const a = state.agents[id], where = placement(state, id);
  if (!a || where.place === "home") return "idle";
  const mine = Object.values(state.tickets).filter((t) => t.to === id);
  const worker = a.kind === "worker" ? a.worker_state : null;
  const activity = state.activities[id]?.activity;
  if (worker === "failed") return "failed";
  if (mine.some((t) => t.status === "waiting_on_owner") || activity === "waiting_owner" || Object.values(state.questions).some((q) => q.asked_by === id) || Object.values(state.approvals).some((a) => a.agent === id)) return "waiting_owner";
  if (worker === "waiting") return "asking";
  if (worker === "reporting") return "reporting";
  if (worker === "blocked") return "blocked";
  if (worker === "paused") return "paused";
  if (where.why === "merge") return "waiting_merge";
  // Finished and accepted: whatever its last turn was doing is over, even if nothing said so.
  if ((worker === "idle" || worker === "completed") && !mine.length) return "idle";
  if (activity && activity !== "idle") return VISUALS[activity] ? activity : "working";
  if (worker === "review" || mine.some((t) => t.status === "in_review")) return "in_review";
  if (mine.length) return "working";
  return Object.values(state.tickets).some((t) => t.from === id) ? "waiting_team" : "idle";
}

// words: what the panel says in plain language. pose: which body animation.
export const VISUALS = {
  understanding: { label: "Understanding", words: "Working out what is being asked", pose: "think" },
  reading: { label: "Reading", words: "Reading a file", pose: "read" },
  researching: { label: "Researching", words: "Looking things up", pose: "read" },
  browsing: { label: "Browsing", words: "Using a browser", pose: "tablet" },
  coding: { label: "Coding", words: "Writing code", pose: "type" },
  running: { label: "Running", words: "Running a command", pose: "type" },
  working: { label: "Working", words: "Working on its task", pose: "type" },
  hiring: { label: "Hiring", words: "Hiring someone", pose: "wave" },
  delegating: { label: "Delegating", words: "Handing work to someone", pose: "point" },
  asking: { label: "Asking", words: "Asking a question", pose: "raise" },
  answering: { label: "Answering", words: "Answering a question", pose: "point" },
  reporting: { label: "Reporting", words: "Reporting back", pose: "clipboard" },
  reviewing: { label: "Reviewing", words: "Reviewing someone's work", pose: "magnify" },
  in_review: { label: "In review", words: "Finished, and waiting for its work to be checked", pose: "wait" },
  summarizing: { label: "Summarizing", words: "Writing a summary", pose: "clipboard" },
  remembering: { label: "Remembering", words: "Saving something to memory", pose: "think" },
  waiting_team: { label: "Waiting for the team", words: "Waiting for its team to finish", pose: "wait" },
  waiting_owner: { label: "Needs you", words: "Waiting for your answer", pose: "alarm" },
  waiting_merge: { label: "Waiting for a merge", words: "Finished, and staying until its work is merged", pose: "wait" },
  failed: { label: "Failed", words: "Its last task failed", pose: "slump" },
  blocked: { label: "Blocked", words: "Blocked and cannot go on", pose: "slump" },
  paused: { label: "Paused", words: "Paused", pose: "still" },
  idle: { label: "Idle", words: "Nothing right now", pose: "rest" },
};

// Plain words for the panel. The detail is agent text: the caller puts it in a text node.
// A ticket's status as a person would say it.
const TICKET_WORDS = { open: "Not started yet", in_progress: "Working on it", in_review: "Being reviewed", waiting_on_owner: "Waiting for you", parked: "On hold", done: "Finished", failed: "Did not finish", cancelled: "Cancelled" };
export const ticketWords = (status) => TICKET_WORDS[status] ?? String(status ?? "").replace(/_/g, " ");
export const ticketTone = (status) => (status === "done" ? "good" : status === "failed" ? "bad" : status === "waiting_on_owner" ? "warn" : "");
// Agents write notes to each other. This drops the bookkeeping in front and keeps the first sentences that fit; `whole` says nothing was cut.
export function plainText(text, max = 170) {
  const clean = String(text ?? "").replace(/^(\s*\((?:parent|for)[^)]*\)\s*|\s*\[[^\]]*\]\s*|\s*(?:parent\s+)?t-[0-9a-f]{8}\b[:.]?\s*)+/i, "").replace(/[`*]+/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return { short: clean, whole: true };
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end >= 60) return { short: cut.slice(0, end + 1), whole: false };
  return { short: `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`, whole: false };
}

export function doingWords(key, detail = "") {
  const words = (VISUALS[key] ?? VISUALS.working).words;
  return detail ? `${words}: ${detail}` : `${words}.`;
}

// Everyone keeps a seat once given one; a newcomer takes the lowest free one. On a page load `previous` is empty.
export function assignSlots(ids, previous = new Map()) {
  const slots = new Map();
  const taken = new Set();
  for (const id of ids) if (previous.has(id)) { slots.set(id, previous.get(id)); taken.add(previous.get(id)); }
  let next = 0;
  for (const id of [...ids].sort()) {
    if (slots.has(id)) continue;
    while (taken.has(next)) next++;
    slots.set(id, next);
    taken.add(next);
  }
  return slots;
}

// A released worker stays home as history, but only the latest few stand in the neighbourhood; the rest are in Workforce.
export const RETIRED_SHOWN = 24;
export function residents(state) {
  const all = Object.values(state.agents).filter((a) => !CORE.has(a.id) && a.kind !== "core");
  const away = all.filter((a) => a.state === "retired" && placement(state, a.id).place === "home").sort((a, b) => (b.last_active_at ?? "").localeCompare(a.last_active_at ?? "") || a.id.localeCompare(b.id));
  const hide = new Set(away.slice(RETIRED_SHOWN).map((a) => a.id));
  return { ids: all.filter((a) => !hide.has(a.id)).map((a) => a.id), hidden: hide.size };
}

// A stable look from the id alone: the same figure on every load and every machine.
export function hashOf(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function identity(id) {
  const h = hashOf(id);
  return { skin: h % 6, hair: (h >>> 3) % 7, hairStyle: (h >>> 6) % 5, shirt: (h >>> 9) % 10, trousers: (h >>> 13) % 4 };
}

// ---------- The map, in tiles of 16 art pixels ----------
export const TILE = 16;
export const BUILDING_H = 5;
// Every department is one tower of the same size, however many work inside (the owner's choice, decision 117):
// workers walk in through the door and are counted on the roof instead of sitting on a terrace that grows.
export const TOWER_H = 12;
const PLOT_W = 9, SEATS_PER_ROW = 4, STREET = 3, HQ_W = 12, HQ_H = 11, HOUSES_PER_ROW = 4, HOUSE_W = 3, HOUSE_ROW_H = 4, HOUSE_BLOCK_ROWS = 3;
// How far the countryside and the roads run on past the town on every side, in tiles (the owner: a larger map).
export const MAP_MARGIN = 48;

// A tower's footprint and height in tiles, fixed by its name (decision 166): the skyline is uneven like a real
// one, but a tower still never grows or shrinks with its headcount (decision 117) and never moves.
export function towerSize(name, portrait = false) {
  const h = hashOf(`size:${name}`);
  return { w: 8 + (h % (portrait ? 3 : 4)), h: 11 + ((h >>> 4) % 5) };
}
// Between two towers on the same side of a row: a side street most of the time, now and then a strip of park.
const gapAfter = (r, k) => (hashOf(`gap:${r}:${k}`) % 3 === 0 ? 2 : STREET);

// An archived department keeps its slot, so a building never lands on another; it isn't drawn unless work is still open there.
// `seats` is { dept: the highest seat in use + 1 }; it only adds a department the registry no longer lists (the
// towers never grow).
// The town (decision 166): HQ and the VAIC plaza in the middle with the neighbourhood under it, the towers on both
// sides of it, each its own size, rows as tall as their tallest tower, side streets wherever they fall.
export function layout(state, { portrait = false, seats = {}, houses = 0 } = {}) {
  const names = departmentNames(state);
  for (const d of Object.keys(seats)) if (d !== "HQ" && !names.includes(d)) names.push(d); // someone works in a department the registry no longer lists
  const n = names.length;
  const cols = portrait ? 2 : Math.max(2, n <= 4 ? 2 : Math.ceil(n / 3));
  const rows = Math.max(2, Math.ceil(n / cols));
  const sizeOf = (name) => (name ? towerSize(name, portrait) : { w: PLOT_W, h: TOWER_H });
  const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => names[r * cols + c]));
  const rowH = grid.map((row) => Math.max(...row.map((name) => sizeOf(name).h)));
  const buildings = [], lots = [], lanes = [];
  const place = (name, slot, x, y, w, h) => {
    if (!name) { lots.push({ x, y, w, h }); return; }
    const reg = state.departments[name];
    if (reg?.state === "demolished" && !seats[name]) { lots.push({ x, y, w, h, demolished: name }); return; }
    buildings.push({ dept: name, slot, x, y, w, h, color: deptColor(name), builtAt: reg?.builtAt ?? 0, archived: reg?.state === "archived" && !seats[name] });
  };
  let width, hqX, avenueX, hqH, westW = [];
  const streets = [];
  let y;
  if (portrait) {
    // A phone: HQ on top, the avenue down the middle, a tower on each side of it in every row.
    const maxW = 10;
    avenueX = 1 + maxW; width = avenueX + STREET + maxW + 1; hqX = Math.round((width - HQ_W) / 2); hqH = HQ_H;
    streets.push({ y: 1 + HQ_H, x0: 0, x1: width });
    y = 1 + HQ_H + STREET;
    grid.forEach((row, r) => {
      row.forEach((name, c) => { const s = sizeOf(name); place(name, r * cols + c, c === 0 ? avenueX - s.w : avenueX + STREET, y + rowH[r] - s.h, s.w, s.h); });
      y += rowH[r]; streets.push({ y, x0: 0, x1: width }); y += STREET;
    });
  } else {
    // Columns alternate east and west of HQ, nearest first: east of the avenue, then west of HQ, and outwards.
    const side = (c) => (c % 2 === 0 ? "east" : "west");
    westW = grid.map((row, r) => { let w = 0, k = 0; row.forEach((name, c) => { if (side(c) !== "west") return; w += (k ? gapAfter(r, `w${k - 1}`) : STREET) + sizeOf(name).w; k++; }); return w; });
    hqX = 1 + Math.max(0, ...westW); avenueX = hqX + HQ_W; hqH = rowH[0];
    width = 0; y = 1;
    grid.forEach((row, r) => {
      const top = y, bottom = y + rowH[r];
      let east = avenueX + STREET, west = hqX - STREET, ke = 0, kw = 0;
      const eastCount = row.filter((_, c) => side(c) === "east").length, westCount = row.length - eastCount;
      row.forEach((name, c) => {
        const s = sizeOf(name);
        if (side(c) === "east") {
          place(name, r * cols + c, east, bottom - s.h, s.w, s.h);
          east += s.w;
          if (ke < eastCount - 1) { const g = gapAfter(r, `e${ke}`); if (g === STREET) lanes.push({ x: east, y0: r ? top : -MAP_MARGIN, y1: bottom }); east += g; }
          ke++;
        } else {
          const x = west - s.w;
          place(name, r * cols + c, x, bottom - s.h, s.w, s.h);
          west = x;
          if (kw < westCount - 1) { const g = gapAfter(r, `w${kw}`); if (g === STREET) lanes.push({ x: west - STREET, y0: r ? top : -MAP_MARGIN, y1: bottom }); west -= g; }
          kw++;
        }
      });
      width = Math.max(width, east + 1);
      y = bottom; streets.push({ y, x0: 0, x1: 0 }); y += STREET;
    });
  }
  const officesEnd = y - STREET;
  const home = [];
  let homesY, homesW, homesH;
  if (portrait) {
    // Under the offices, in rows; the avenue runs on down between them.
    homesY = y; homesW = width - 2;
    const xs = [];
    for (let x = 1; x + HOUSE_W <= width - 1; x += HOUSE_W) if (x + HOUSE_W <= avenueX || x >= avenueX + STREET) xs.push(x);
    for (let i = 0; i < houses; i++) home.push({ x: xs[i % xs.length], y: homesY + Math.floor(i / xs.length) * HOUSE_ROW_H });
    homesH = Math.max(Math.ceil(houses / xs.length) * HOUSE_ROW_H, HOUSE_ROW_H);
  } else {
    // Under HQ, in a block between each pair of streets; more houses than fit add blocks (and streets) below.
    homesY = 1 + hqH + STREET; homesW = HQ_W;
    const blocks = [];
    let top = homesY;
    for (let r = 1; r < rows; r++) { blocks.push({ y: top, rows: Math.min(HOUSE_BLOCK_ROWS, Math.floor((rowH[r] - 3) / HOUSE_ROW_H) + 1), bottom: top + rowH[r] }); top += rowH[r] + STREET; }
    let placed = 0, bottom = officesEnd;
    for (let b = 0; placed < houses; b++) {
      if (!blocks[b]) { blocks.push({ y, rows: HOUSE_BLOCK_ROWS, bottom: y + TOWER_H }); streets.push({ y: y + TOWER_H, x0: 0, x1: 0 }); y += TOWER_H + STREET; }
      const bl = blocks[b];
      for (let k = 0; k < HOUSES_PER_ROW * bl.rows && placed < houses; k++, placed++) home.push({ x: hqX + (k % HOUSES_PER_ROW) * HOUSE_W, y: bl.y + Math.floor(k / HOUSES_PER_ROW) * HOUSE_ROW_H });
      bottom = Math.max(bottom, bl.bottom);
    }
    homesH = bottom - homesY;
    for (const s of streets) s.x1 = width; // every street runs edge to edge, and on off the map
    if (westW.some(Boolean)) lanes.push({ x: hqX - STREET, y0: -MAP_MARGIN, y1: Math.max(y, homesY + homesH + 1) + MAP_MARGIN }); // the road west of HQ
  }
  const hq = { dept: "HQ", x: hqX, y: 1, w: HQ_W, h: hqH, color: DEPT_COLOR.HQ };
  return { hq, buildings, lots, lanes, streets, hqStreet: portrait ? 1 + HQ_H : 1 + hqH, officesEnd, avenue: avenueX, width, height: Math.max(y, homesY + homesH + 1), homes: { x: portrait ? 1 : hqX, y: homesY, w: homesW, h: homesH, houses: home }, portrait };
}

// Where a worker at work is: inside the tower, just behind its door (drawn hidden; the roof counts them). The seat
// number still keys who is who, so a worker keeps its place between snapshots.
export const seatRows = () => 0;
export function seatSpot(building, seat) {
  void seat;
  void SEATS_PER_ROW;
  const d = doorOf(building);
  return { x: d.x, y: d.y - 2, inside: true };
}

// Two spots in each house's front yard.
export function homeSpot(world, slot) {
  const h = world.homes.houses[Math.floor(slot / 2)];
  return h ? { x: h.x * TILE + (slot % 2 ? 36 : 12), y: h.y * TILE + 58 } : null;
}

// An evening walk keeps to the streets: to the nearest street, along it to the avenue, along the avenue, and in.
export function walkRoute(world, from, to) {
  const lanes = [...world.streets.map((s) => (s.y + STREET / 2) * TILE), ...new Set(world.homes.houses.map((h) => h.y * TILE - 5))];
  const nearest = (y) => lanes.reduce((best, l) => (Math.abs(l - y) < Math.abs(best - y) ? l : best), lanes[0] ?? y);
  const ax = (world.avenue + STREET / 2) * TILE, a = nearest(from.y), b = nearest(to.y);
  return a === b ? [{ x: from.x, y: a }, { x: to.x, y: a }, to] : [{ x: from.x, y: a }, { x: ax, y: a }, { x: ax, y: b }, { x: to.x, y: b }, to];
}

// The street-side door at the foot of a tower: everyone enters and leaves here (the manager stands beside it).
export function doorOf(building) {
  return { x: (building.x + building.w / 2) * TILE, y: (building.y + building.h) * TILE - 6 };
}

// A commute keeps to the streets and uses doors: out through the door of the building being left, along the
// roads (crossing at the avenue, like walkRoute), and in through the door of the building being entered.
export function commuteRoute(world, from, to, { leaving = null, entering = null } = {}) {
  const route = [];
  let start = from;
  if (leaving) {
    const d = doorOf(leaving);
    route.push(d);
    start = d;
  }
  const street = entering ? doorOf(entering) : to;
  route.push(...walkRoute(world, start, street));
  if (entering) route.push(to);
  return route;
}

// Fast enough that a commute takes about COMMUTE_MS whatever its length, never slower than an evening stroll.
export const WALK_PX_S = 46;
export const COMMUTE_MS = 2500;
export function walkSpeed(route, from) {
  let len = 0;
  let at = from;
  for (const p of route) {
    len += Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
  }
  return Math.max(WALK_PX_S, len / (COMMUTE_MS / 1000));
}

// People take turns at a door instead of overlapping: the i-th walker sets off this much later.
export const staggerMs = (i) => i * 350;

// What the map should say when it has nothing to show. Null when people and offices speak for themselves.
export function cityMessage(state) {
  const others = Object.keys(state.agents).filter((id) => !CORE.has(id));
  if (!standingDepartments(state).length) return "No departments yet. An office goes up the moment a prompt needs one.";
  if (!others.some((id) => placement(state, id).place === "station")) return "Nobody is at a desk right now. Everyone is home or at HQ.";
  return null;
}

// VAIC's status call can fire many times in a row; only the first of a burst is a visit.
export const visitAllowed = (lastAt, now, to) => to !== "ace" && now - lastAt >= 1000;

export const currentTicket = (state, id) => Object.values(state.tickets).filter((t) => t.to === id).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0] ?? null;

export function agentPanel(state, id, audit = []) {
  const a = state.agents[id];
  if (!a) return null;
  const t = currentTicket(state, id);
  const today = state.costs[id];
  return {
    id, role: a.role, kind: a.kind, executor: a.executor ?? null, lastTicket: state.recent[id]?.ticket ?? null, model: a.model, modelName: MODEL_NAME[a.model] ?? a.model, modelColor: MODEL_COLOR[a.model] ?? "#ccc", department: deptOf(a), parent: a.parent,
    status: agentStatus(state, id),
    ticket: t ? { id: t.id, goal: t.goal, status: t.status } : null,
    actions: audit.slice(-10).map((x) => ({ at: x.ts, text: `${x.decision === "allow" ? "" : `${x.decision}: `}${x.tool}${x.reason ? ` (${x.reason})` : ""}` })),
    costUsd: a.total_cost_usd ?? null, tokensToday: today?.tokens ?? null,
    prop: propFor(a),
  };
}

export function departmentPanel(state, dept) {
  const everyone = Object.values(state.agents).filter((a) => deptOf(a) === dept);
  const members = everyone.filter((a) => a.state !== "retired");
  const ids = new Set(members.map((a) => a.id));
  const reg = state.departments[dept];
  // Spend is keyed by the agents' spellings, so an old install's "app" and "App" add up here.
  const spent = Object.entries(state.spend).filter(([k]) => keyOf(k) === keyOf(dept)).map(([, v]) => v);
  return {
    name: dept,
    mission: reg?.mission || null,
    state: reg?.state ?? null,
    manager: reg?.manager_id ?? members.find((a) => a.kind === "manager")?.id ?? (dept === "HQ" ? "orchestrator" : null),
    workers: members.filter((a) => a.kind === "worker").map((a) => a.id),
    workerStates: Object.fromEntries(members.filter((a) => a.kind === "worker").map((a) => [a.id, agentStatus(state, a.id)])),
    released: everyone.filter((a) => a.state === "retired").map((a) => ({ id: a.id, role: a.role })), // history: their row, tickets and costs stay
    openTickets: Object.values(state.tickets).filter((t) => ids.has(t.to)).map((t) => ({ id: t.id, goal: t.goal, status: t.status, to: t.to })),
    todayUsd: spent.length ? spent.reduce((a, b) => a + b, 0) : null,
  };
}

// How many agents stand at work in a department building (not HQ). The City counts lit windows the same way.
export const agentsAtWork = (state) => Object.values(state.agents).filter((a) => !CORE.has(a.id) && a.kind !== "core" && placement(state, a.id).place === "station").length;

// Running right now: a worker waiting for an answer or whose work is in review is not working (the owner,
// 2026-11-09: the counter showed 1 while no job ran).
const BUSY = new Set(["working", "reporting"]);
/** Workers on a job right now: the number the owner asked for when they set how many agents a task gets. */
export const workersWorking = (state) =>
  Object.values(state.agents).filter((a) => a.kind === "worker" && a.state !== "retired" && BUSY.has(a.worker_state)).length;

export function topBar(state) {
  const agents = Object.values(state.agents).filter((a) => !CORE.has(a.id) && a.kind !== "specialist");
  return {
    agentsTotal: agents.length,
    // "Agents working now" = workers running right now (not waiting on an answer, not in review). Managers,
    // the Orchestrator and VAIC never count, nor do idle or finished workers (the owner, 2026-11-08).
    agentsActive: workersWorking(state),
    ticketsRunning: Object.values(state.tickets).filter((t) => t.status === "in_progress" || t.status === "in_review").length,
    questionsWaiting: Object.keys(state.questions).length + Object.keys(state.approvals).length,
    parked: Object.keys(state.parked).length,
    usage: state.usage,
  };
}

export const fmt = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : typeof v === "number" ? v.toFixed(digits) : String(v));

// Everything that waits for the owner, as one list: a pending merge confirmation first (it expires),
// then open agent questions, oldest first. `confirm` is { id, ..., expiresAt } (epoch ms) or null.
// An expired confirmation is not listed. Pure: nothing here sends or answers anything.
export function inboxItems(state, confirm, now = Date.now()) {
  const items = [];
  if (confirm && Number(confirm.expiresAt) > now) items.push({ kind: "merge", id: confirm.id, confirm });
  const qs = Object.values(state?.questions ?? {}).filter((q) => q.status === "open" && q.question)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || String(a.id).localeCompare(String(b.id)));
  for (const q of qs) items.push({ kind: "question", id: q.id, path: q.question.path ?? "", questions: q.question.questions ?? [], created_at: q.created_at });
  return items;
}

// ---------- Status board: limits, agents and tickets, as plain data ----------
export const STALE_MS = 2 * 3600 * 1000;
export const TICKET_ORDER = ["open", "in_progress", "in_review", "waiting_on_owner"];

// How the city is doing against its caps. A cap is null when the server did not send one: the board says so, it never guesses.
export function limits(state) {
  const caps = state.caps ?? {};
  const cap = (k) => (typeof caps[k] === "number" ? caps[k] : null);
  const agents = Object.values(state.agents);
  const active = agents.filter((a) => a.kind !== "core" && a.kind !== "executive" && a.state === "active").length; // the rule runtime.ts applies when hiring
  const workersMax = agents.filter((a) => a.kind === "manager").reduce((m, mgr) => Math.max(m, agents.filter((a) => a.parent === mgr.id && a.state === "active").length), 0);
  const spendCap = cap("daily_spend_usd_per_department");
  const departments = Object.entries(state.spend ?? {}).map(([dept, usd]) => ({ dept, usd, cap: spendCap, over: spendCap !== null && usd > spendCap, pct: spendCap ? Math.min(100, (usd / spendCap) * 100) : null }));
  // Active agents against the cap, per department. The cap is department_caps[dept] ?? the default; a snapshot from
  // before the restart (only max_concurrent_agents) has neither, so the cap is null, never guessed.
  const defaultCap = cap("max_active_agents_per_department");
  const deptCaps = caps.department_caps ?? {};
  const names = [...new Set(agents.filter((a) => a.kind !== "core" && a.department).map((a) => a.department))].sort();
  const agentsByDepartment = names.map((dept) => {
    const n = agents.filter((a) => a.kind !== "core" && a.state === "active" && a.department === dept).length;
    const c = typeof deptCaps[dept] === "number" ? deptCaps[dept] : defaultCap;
    return { dept, active: n, cap: c, full: c !== null && n >= c };
  });
  return {
    known: state.caps !== null && state.caps !== undefined,
    // Total across departments. `max` is only set by an older server that still enforces a total cap.
    agents: { active, max: cap("max_concurrent_agents") },
    // Only a server that sends the per-department cap says "no total cap"; an older snapshot keeps the plain label.
    agentsLabel: defaultCap !== null ? "AGENTS ACTIVE (no total cap; per department below)" : "AGENTS ACTIVE",
    agentsByDepartment,
    agentCapPerDepartment: defaultCap,
    workersPerManager: { largest: workersMax, max: cap("max_workers_per_manager") },
    departments,
    usage: state.usage ? { turns: state.usage.turns, tokens: state.usage.tokens, usd: state.usage.usd } : null,
  };
}

const ms = (iso) => { const t = Date.parse(iso ?? ""); return Number.isNaN(t) ? null : t; };
export function relTime(msAgo) {
  if (msAgo === null || msAgo === undefined) return "—";
  const s = Math.max(0, Math.round(msAgo / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export function ageText(msAgo) { return msAgo === null ? "—" : relTime(msAgo).replace(" ago", "").replace("just now", "<1 min"); }

// Open work grouped by status, oldest first. `stale`: nothing has touched the ticket for more than two hours.
export function ticketGroups(state, now = Date.now()) {
  return TICKET_ORDER.map((status) => ({
    status,
    tickets: Object.values(state.tickets).filter((t) => t.status === status).map((t) => {
      const created = ms(t.created_at), updated = ms(t.updated_at);
      return { id: t.id, to: t.to, goal: t.goal, ageMs: created === null ? null : now - created, stale: updated !== null && now - updated > STALE_MS };
    }).sort((a, b) => (b.ageMs ?? -1) - (a.ageMs ?? -1)),
  }));
}

// One row per live agent. Core agents come separately; retired agents are not listed.
export function agentRows(state, now = Date.now()) {
  const rows = Object.values(state.agents).filter((a) => a.state !== "retired").map((a) => {
    const t = currentTicket(state, a.id), last = ms(a.last_active_at);
    return { id: a.id, role: a.role, state: a.state, model: a.model, modelName: MODEL_NAME[a.model] ?? a.model, department: deptOf(a), goal: t?.goal ?? null, lastActiveMs: last === null ? null : now - last, core: a.kind === "core" };
  });
  return { core: rows.filter((r) => r.core), others: rows.filter((r) => !r.core) };
}

// ---------- The gate, parked tickets, and what the panels read ----------
export const stockholmTime = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(t);

export function gateStatus(state) {
  const c = state.city;
  return { known: !!c, running: c?.running ?? null, waiting: c?.waiting ?? null };
}

export function parkedRows(state, now = Date.now()) {
  return Object.values(state.parked).map((t) => {
    const created = ms(t.created_at), updated = ms(t.updated_at);
    return { id: t.id, to: t.to, from: t.from, goal: t.goal, ageMs: created === null ? null : now - created, quietMs: updated === null ? null : now - updated };
  }).sort((a, b) => (b.ageMs ?? -1) - (a.ageMs ?? -1));
}

// A ticket moving between two agents, from the event itself: the sender hands it over, the worker hands the result back.
export function courierFor(event) {
  if (event.type !== "ticket.status") return null;
  const t = event.ticket;
  if (!t.from || !t.to || t.from === t.to) return null;
  if (event.previous === null) return { from: t.from, to: t.to, kind: "ticket" };
  return t.status === "done" || t.status === "failed" ? { from: t.to, to: t.from, kind: "result" } : null;
}

export const workforceGroups = (wf) => ({ current: (wf?.workers ?? []).filter((w) => w.state !== "released"), released: (wf?.workers ?? []).filter((w) => w.state === "released") });
export const usdRows = (byKey) => Object.entries(byKey ?? {}).map(([name, v]) => ({ name, ...v }));

export const INTEGRATION_MEANS = [
  ["operational", "a real probe answered"],
  ["authenticated", "a credential is present, not exercised"],
  ["available", "on this Mac, not proven working"],
  ["needs_owner", "needs you to sign in or fix it"],
  ["unavailable", "not installed or not reachable"],
  ["unknown", "not checked"],
];
// What the probe actually looked at. Names only: a keychain probe reads metadata, never the value.
export function checkText(check) {
  if (!check) return null;
  if (check.command) return check.command.join(" ");
  if (check.mcp) return `claude mcp list: ${check.mcp}`;
  if (check.port) return `port ${check.port}`;
  if (check.keychain) return `Keychain item ${check.keychain} exists`;
  if (check.bin) return `which ${check.bin}`;
  return null;
}
export function integrationGroups(list) {
  const groups = new Map();
  for (const i of list ?? []) { const c = i.category || "other"; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); }
  return [...groups].map(([category, items]) => ({ category, items }));
}

// A ticket's story, one plain line per recorded event. The runtime sends each question twice; the story tells it once.
export function traceLines(events) {
  const seen = new Set((events ?? []).filter((e) => e.type === "question.asked").map((e) => e.id));
  return (events ?? []).filter((e) => e.type !== "question" || !seen.has(e.id)).map((e) => ({ at: e.at, type: e.type, text: traceText(e) }));
}
function traceText(e) {
  switch (e.type) {
    case "ticket.status": { const t = e.ticket; return e.previous === null ? `${t.from} sent ${t.to}: ${t.goal}` : `${t.to}: ${e.previous} → ${t.status}`; }
    case "question.asked": case "question": return `${e.question?.path ?? e.question?.asked_by ?? "An agent"} asked: ${e.question?.questions?.[0]?.text ?? ""}`;
    case "question.answered": return `${e.answered_by} answered: ${e.answer}`;
    case "review.started": return `Review round ${e.round} started by ${e.by}`;
    case "review.result": return `Review round ${e.round}: ${e.verdict}. ${e.summary ?? ""}`;
    case "cost.update": return `${e.agent}: a turn of ${e.tokens} tokens, ${estUsd(e.usd, 3)}`;
    case "result": return `Result (${e.status}): ${e.summary}`;
    case "turn.failed": return `${e.agent || "A turn"} failed${e.retrying ? ", retrying" : ""}: ${e.error}`;
    default: return e.type;
  }
}

// ---------- Departments on demand, taxis and the mailman (decision 134) ----------

// How long each building animation runs, in ms.
export const ANIM_MS = { rise: 900, build: 3200, demolish: 2600 };
export const RISE_STAGGER_MS = 110;
// Where a building animation is: 0 … 1 (clamped), from its start and its kind.
export const animProgress = (anim, now) => Math.max(0, Math.min(1, (now - anim.start) / (anim.dur ?? ANIM_MS[anim.kind] ?? 1000)));
// The page-load entrance: every tower rises in turn, left to right and front to back (its slot order).
export function entranceAnims(buildings, start) {
  return [...buildings].filter((b) => !b.archived).sort((a, b) => a.slot - b.slot).map((b, i) => ({ dept: b.dept, kind: "rise", start: start + i * RISE_STAGGER_MS, dur: ANIM_MS.rise }));
}
// How far a tower stands out of the ground (0 … 1) at progress k: rising overshoots a little and settles; building
// stacks floors from the street up; demolition shakes, then sinks into its dust.
export function standFraction(kind, k) {
  if (kind === "rise") { const e = 1 - (1 - k) ** 3; return Math.min(1.04, e * 1.04) - (k > 0.85 ? (k - 0.85) * 0.27 : 0); }
  if (kind === "build") return k < 0.08 ? 0 : Math.min(1, (k - 0.08) / 0.84);
  if (kind === "demolish") return k < 0.3 ? 1 : Math.max(0, 1 - ((k - 0.3) / 0.62) ** 1.6);
  return 1;
}

// The mailman (the owner's picture, 2026-11-09): an instruction from the Orchestrator to a manager is a letter he
// cycles over to that department's tower; a manager's reply rides back to the Orchestrator the same way.
// Null for every other event.
export function mailFor(event, state) {
  if (event.type !== "ticket.status") return null;
  const t = event.ticket, dept = t.department;
  if (!dept || !state?.departments?.[dept]) return null;
  if (event.previous === null && t.from === "orchestrator" && t.to && t.to !== "orchestrator") return { dept, dir: "out", ticket: t.id };
  if (t.from === "orchestrator" && (t.status === "done" || t.status === "failed") && event.previous !== t.status) return { dept, dir: "back", ticket: t.id };
  return null;
}
// The letters waiting for the one mailman: a new one joins the queue; a burst to the same tower in the same
// direction rides as one bundle (its count goes up) so a busy morning never becomes a parade.
export const MAIL_QUEUE_MAX = 8;
export function enqueueMail(queue, mail) {
  const same = queue.find((m) => m.dept === mail.dept && m.dir === mail.dir);
  if (same) return queue.map((m) => (m === same ? { ...m, letters: (m.letters ?? 1) + 1 } : m));
  return [...queue, { ...mail, letters: 1 }].slice(-MAIL_QUEUE_MAX);
}
// The bicycle rides the same streets the people walk, quicker, never longer than about four seconds a leg.
export const BIKE_PX_S = 70, BIKE_LEG_MS = 4000;
export function bikeSpeed(route, from) {
  let len = 0, at = from;
  for (const p of route) { len += Math.hypot(p.x - at.x, p.y - at.y); at = p; }
  return Math.max(BIKE_PX_S, len / (BIKE_LEG_MS / 1000));
}

// Yellow cabs. Each street has two lanes, westbound above the centre line and eastbound below it; each avenue has
// two, southbound on the left and northbound on the right. Every lane runs the whole road, out through the
// countryside to the map's faded border, so a cab arrives from beyond the edge and drives off beyond it.
export function streetLanes(world) {
  const M = MAP_MARGIN * TILE, x0 = -M, x1 = world.width * TILE + M;
  return world.streets.map((s) => ({ y0: s.y * TILE + 17, y1: s.y * TILE + 33, x0: s.x0 === 0 ? x0 : s.x0 * TILE, x1: s.x1 === world.width ? x1 : s.x1 * TILE }));
}
export function avenueLanes(world) {
  const M = MAP_MARGIN * TILE, top = world.portrait ? (world.hqStreet + STREET / 2) * TILE : -M, bottom = world.height * TILE + M;
  return [{ x0: world.avenue * TILE + 18, x1: world.avenue * TILE + 30, y0: top, y1: bottom }];
}
// A cab's opacity: it fades in over the last stretch before a lane's end and out over the same stretch after it,
// so it never appears or vanishes in the middle of a road.
export const CAB_FADE_PX = 6 * TILE;
export function edgeAlpha(pos, from, to) {
  return Math.max(0, Math.min(1, Math.min(pos - from, to - pos) / CAB_FADE_PX));
}
// One cab in a thousand that arrives is the owner's car instead (2026-11-09): a black pixel sports car with chrome
// rims, otherwise exactly a cab (same lane, speed, fade, roof light and passengers). Decided per arrival from a
// seed, so the same arrival is always the same car.
export const RARE_CAB_ODDS = 1000;
export function seededRandom(seed) {
  let t = (hashOf(seed) + 0x6d2b79f5) >>> 0; // mulberry32, one step
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rareCab = (seed) => seededRandom(seed) < 1 / RARE_CAB_ODDS;
// The cabs cruising on their own, placed by the clock alone (a slow frame never bunches them up). Cabs sharing a
// lane share its speed, so they keep their distance; about one per 22 tiles of road each way.
export const CAB_PX_S = 34, CAB_GAP_PX = 22 * TILE;
export function trafficAt(world, now) {
  const out = [];
  const lane = (id, from, to, place) => {
    const span = to - from, n = Math.max(1, Math.round(span / CAB_GAP_PX)), speed = CAB_PX_S * (0.85 + (hashOf(id) % 30) / 100);
    for (let k = 0; k < n; k++) {
      const run = (now / 1000) * speed + (k * span) / n + (hashOf(`${id}:${k}`) % Math.max(1, Math.round(span / n / 2)));
      const d = run % span, lap = Math.floor(run / span); // each lap past the border is a new cab arriving
      out.push({ ...place(d), alpha: edgeAlpha(d, 0, span), id: `${id}:${k}`, rare: rareCab(`${id}:${k}:${lap}`) });
    }
  };
  streetLanes(world).forEach((l, i) => {
    lane(`e${i}`, l.x0, l.x1, (d) => ({ x: l.x0 + d, y: l.y1, east: true, vertical: false }));
    lane(`w${i}`, l.x0, l.x1, (d) => ({ x: l.x1 - d, y: l.y0, east: false, vertical: false }));
  });
  avenueLanes(world).forEach((l, i) => {
    lane(`s${i}`, l.y0, l.y1, (d) => ({ x: l.x0, y: l.y0 + d, east: false, vertical: true }));
    lane(`n${i}`, l.y0, l.y1, (d) => ({ x: l.x1, y: l.y1 - d, east: true, vertical: true }));
  });
  return out;
}
// A commute by cab: which legs of a route are ridden. A leg is ridden when it runs along a street or the avenue,
// from the first kerb a cab can reach to the kerb in front of the tower; the path between the houses (grass, no
// cabs) and the steps through the doors stay a walk.
export function rideLegs(world, route, from) {
  const lanes = new Set(world.streets.map((s) => (s.y + STREET / 2) * TILE));
  const ax = (world.avenue + STREET / 2) * TILE;
  const onRoad = (p) => lanes.has(p.y) || p.x === ax;
  let prev = from;
  return route.map((p) => { const ride = onRoad(prev) && onRoad(p) && (p.x !== prev.x || p.y !== prev.y); prev = p; return ride; });
}
