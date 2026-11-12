// Ported from the owner's Mac HUD (ai-city/jarvis/hud/city-state.js) and adapted to AI City on AWS:
// VAIC and the Orchestrator are the core; there is no Secretary or Reviewer; events and snapshots come
// from the AWS API and WebSocket. Pure functions, no DOM, unit-tested in Node.
// The City View's state: what the scene draws, as plain data. Pure functions, no DOM, no three.js,
// so the event → state step is unit-tested in Node. The scene reads this; it never reads the server.

export const MODEL_COLOR = { "haiku-5-5": "#ffd21e", "opus-5-5": "#3b82ff", "sonnet-5-5": "#2fd36b", "fable-5-1": "#a86bff" };
export const MODEL_NAME = { "haiku-5-5": "Haiku 5.5", "opus-5-5": "Opus 5.5", "sonnet-5-5": "Sonnet 5.5", "fable-5-1": "Fable 5.1" };
export const DEPT_COLOR = { HQ: "#3b82ff", IT: "#4cc9f0", App: "#ff7a45", Cloud: "#8ecae6", Marketing: "#f72585", Video: "#b5179e", Travel: "#06d6a0", other: "#9aa0a6" };
export const CORE = new Set(["vaic", "orchestrator"]);
export const TOOL_PROP = [["ios|swift|app", "laptop"], ["video|film|camera", "camera"], ["market|ads|growth", "chart"], ["cloud|infra|terraform|devops", "wrench"], ["travel|flight|hotel", "ticket"], ["qa|test", "clipboard"], [".", "laptop"]];
export const FEED_MAX = 120;
// Every dollar figure in the HUD is this: a value at list prices, not money that moved.
export const COST_NOTE = "Estimate from token counts at list prices. The AWS bill is the truth.";
export const estUsd = (v, digits = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : `est. $${Number(v).toFixed(digits)}`);
const RECENT_MS = { done: 6000, review_fail: 20000, hired: 4000, retired: 4000 };

export function initialState(now = Date.now()) {
  return { agents: {}, activities: {}, tickets: {}, questions: {}, approvals: {}, departments: {}, reviews: {}, costs: {}, usage: null, spend: {}, caps: null, parked: {}, city: null, capHit: null, feed: [], recent: {}, apps: {}, connectors: {}, lots: {}, freed: {}, now };
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
  // The lots (decision 248): a server that numbers them sends them; from an older one the City keeps the numbers it gave.
  const served = Array.isArray(snap.lots);
  next.lots = served ? Object.fromEntries(snap.lots.filter((l) => Number.isInteger(l?.slot)).map((l) => [l.slot, String(l.size ?? "")])) : { ...(state.lots ?? {}) };
  // When each empty lot's tower came down, so its saplings keep growing across reloads (decision 259).
  next.freed = served ? Object.fromEntries(snap.lots.filter((l) => Number.isInteger(l?.slot) && !Number.isNaN(Date.parse(l.freed_at ?? ""))).map((l) => [l.slot, Date.parse(l.freed_at)])) : { ...(state.freed ?? {}) };
  for (const d of listed ? snap.departments : []) {
    const born = Date.parse(d.created_at ?? "");
    const slot = Number.isInteger(d.slot) ? d.slot : served ? undefined : state.departments?.[d.name]?.slot;
    if (d.state !== "deleted") next.departments[d.name] = { ...d, slot, builtAt: Math.min(now - 60000, Number.isNaN(born) ? Infinity : born) }; // already built: no construction animation
  }
  for (const a of snap.agents ?? []) {
    next.agents[a.id] = filed(next.departments, a);
    if (!listed) next.departments = touch(next, deptOf(a), now - 60000);
  }
  Object.assign(next, numberLots(next.departments, next.lots));
  // Saved specialists who are not hired right now live in the apartment buildings.
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
  for (const c of snap.connectors ?? []) if (c?.id && c.status === "ready") next.connectors[c.id] = c;
  next.usage = snap.usage ?? null;
  next.spend = snap.spend ?? {};
  next.caps = snap.caps ?? null; // the limits the server enforces; null when the server did not send them
  return staffed(next);
}

// The id the runtime gives a department's manager (manager_id in backend/src/vaic/shared/ids.py).
export const managerIdOf = (name) => `mgr-${String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x"}`;

// Every standing tower has its Department Manager at the door at all times (the owner, 2026-11-11, decision 212),
// built-in or built on demand, even before the runtime has hired him (it does so with the department's first goal).
// A department without a manager record gets a stand-in from its registry entry, marked `standin`; the real record
// replaces it as soon as it arrives. Returns the same state when nothing changes.
export function staffed(state) {
  const standing = Object.values(state.departments).filter((d) => d.name !== "HQ" && d.state !== "demolished");
  const want = new Map(standing.map((d) => [keyOf(d.name), d]));
  const real = new Set(Object.values(state.agents).filter((a) => a.kind === "manager" && !a.standin && a.state !== "retired").map((a) => keyOf(a.department)));
  let agents = null;
  for (const a of Object.values(state.agents)) {
    if (!a.standin) continue;
    const k = keyOf(a.department);
    if (!want.has(k) || real.has(k)) { agents ??= { ...state.agents }; delete agents[a.id]; }
  }
  for (const [k, d] of want) {
    if (real.has(k)) continue;
    const id = d.manager_id || managerIdOf(d.name);
    const have = (agents ?? state.agents)[id];
    if (have && have.standin && have.department === d.name && have.state !== "retired") continue;
    if (have && !have.standin && have.state !== "retired") continue;
    agents ??= { ...state.agents };
    agents[id] = { id, kind: "manager", role: `${d.name} Reviewer`, department: d.name, model: "fable-5-1", parent: "orchestrator", state: "dormant", worker_state: null, total_cost_usd: 0, standin: true };
  }
  return agents ? { ...state, agents } : state;
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
  const next = staffed(reduceEvent(state, event, now));
  if (next.feed === state.feed || !next.feed.length) return next;
  const story = storyOf(event, state);
  return story ? { ...next, feed: [{ ...next.feed[0], story }, ...next.feed.slice(1)] } : next;
}

const an = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
// "Writer" → "writer" inside a sentence; a name like "JavaScript developer" or "QA tester" keeps its capitals.
const inSentence = (role) => (/^[A-Z][a-z]+(\s|$)/.test(role) ? role.charAt(0).toLowerCase() + role.slice(1) : role);
const shortGoal = (text) => plainText(text, 60).short;

// A department's manager is its reviewer (decision 295, the build design of the project board: it checks every part its
// department finishes), and the City calls it so: "<Department> Reviewer" wherever a role is shown.
export const roleOf = (a) => (a?.kind === "manager" ? `${deptOf(a)} Reviewer` : a?.role ?? "");
// The department a review belongs to: named on the event, else its reviewer's, else its ticket's.
function reviewDept(state, event, t) {
  const r = event.reviewer && state.agents[event.reviewer];
  return event.department ?? (r ? deptOf(r) : null) ?? t?.department ?? (t?.to && state.agents[t.to] ? deptOf(state.agents[t.to]) : null);
}
// Is a department's reviewer reviewing right now (decision 295)? While it is, it works inside its tower (one lit window,
// counted in "Agents working now"), however many parts it is checking. Today a review shows as the reviewer's
// "reviewing" activity (its review tool), until the review's result; the board's `review.started` / `review.finished`
// events open and close one too. A review left open is let go after REVIEW_STALE_MS.
export const REVIEW_STALE_MS = 15 * 60_000;
const when = (at) => (typeof at === "number" ? at : Date.parse(at ?? "") || 0);
export function isReviewing(state, id, now = state.now) {
  const a = state.agents[id];
  if (!a || a.kind !== "manager" || a.state === "retired") return false;
  const act = state.activities?.[id];
  if (act?.activity === "reviewing" && now - when(act.at) < REVIEW_STALE_MS) return true;
  const dept = deptOf(a);
  return Object.values(state.reviews ?? {}).some((r) => !r.verdict && r.department === dept && now - when(r.at) < REVIEW_STALE_MS);
}
/** Who someone is, in words the owner knows: never an id. */
export function plainWho(state, id) {
  if (id === "vaic") return "VAIC";
  if (id === "orchestrator") return "The planner";
  const a = state.agents?.[id];
  if (!a) return "Someone on the team";
  if (a.kind === "manager") return `The ${deptOf(a)} reviewer`;
  if (a.kind === "executive") return `The ${a.role}`;
  return a.role ? `The ${inSentence(a.role)} in ${deptOf(a)}` : `A worker in ${deptOf(a)}`;
}

// What happened, for the owner: `one` for a single event, `many` (with {n}) when a burst of the same `key` is
// grouped into one line. Null: bookkeeping (status moves, colleagues talking, retries) that stays off the panel.
function storyOf(event, s) {
  switch (event.type) {
    case "agent.hired": {
      const a = event.agent, d = deptOf(a);
      if (a.kind === "manager") return { key: `mgr:${d}`, one: `${d} got a reviewer` };
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
      const job = t.kind === "task" || (!t.parent_id && t.from === "vaic");
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
      return { ...state, now, agents: { ...state.agents, [a.id]: a }, ...numberLots(touch(state, deptOf(a), now), state.lots), recent: { ...state.recent, [a.id]: { kind: "hired", at: now } }, feed: feed(state, `${a.role} ${event.revived ? "is back" : "hired"} in ${deptOf(a)}`, "hire", now) };
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
      // A part under review that is finished, failed, parked or sent back to work: its review is over (decision 295).
      const open = state.reviews?.[t.id], over = open && !open.verdict && (terminal || ["parked", "open"].includes(t.status) || (t.status === "in_progress" && event.previous === "in_review"));
      const reviews = over ? { ...state.reviews, [t.id]: { ...open, verdict: "DONE", at: now } } : state.reviews;
      return { ...state, now, tickets, parked, recent, reviews, feed: feed(state, text, t.status, now) };
    }
    case "build.stage": {
      // The board's timing marks (decision 294): a part's review starting (and, should it come, ending) opens and
      // closes a review of its department, so its reviewer works inside (decision 295).
      if (event.stage !== "review" || !event.key) return state;
      return event.edge === "start" ? reduce(state, { type: "review.started", ticket_id: event.key, round: 1 }, now) : event.edge === "end" ? reduce(state, { type: "review.finished", ticket_id: event.key }, now) : state;
    }
    case "question.asked":
      return state.questions[event.question.id] ? state : asked(state, event, now);
    case "question.answered": {
      const questions = { ...state.questions };
      delete questions[event.id];
      return { ...state, now, questions, feed: feed(state, `${event.answered_by} answered: ${event.answer.slice(0, 60)}`, "answer", now) };
    }
    case "review.started": {
      const t = state.tickets[event.ticket_id], department = reviewDept(state, event, t);
      return { ...state, now, reviews: { ...state.reviews, [event.ticket_id]: { round: event.round, verdict: null, at: now, agent: t?.to ?? null, department } }, feed: feed(state, `The ${department ?? "department"} reviewer is checking ${t?.to ?? event.ticket_id}'s work (round ${event.round ?? 1})`, "review", now) };
    }
    case "review.result":
    case "review.finished": {
      // The review is over: the reviewer walks back out (decision 295), whatever it was doing last.
      const prev = state.reviews[event.ticket_id], verdict = event.verdict ?? "DONE";
      const activities = { ...state.activities };
      for (const [aid, x] of Object.entries(activities)) if (x?.activity === "reviewing" && (aid === event.reviewer || (state.agents[aid]?.kind === "manager" && deptOf(state.agents[aid]) === (prev?.department ?? reviewDept(state, event, state.tickets[event.ticket_id]))))) activities[aid] = { activity: "idle", detail: null, at: now };
      const next = { ...state, now, activities, reviews: { ...state.reviews, [event.ticket_id]: { ...prev, round: event.round ?? prev?.round, verdict, at: now } } };
      return event.type === "review.result" ? { ...next, feed: feed(state, `Review ${event.verdict}: ${String(event.summary ?? "").slice(0, 60)}`, event.verdict === "PASS" ? "pass" : "fail", now) } : next;
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
      const { id, activity, detail } = event, at = event.at ?? now; // when it arrived, if the event doesn't say
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
    case "connector.updated": {
      // Decision 173: a connected tool hangs its sign by the doors of the departments that use it.
      if (!event.id || event.status === "syncing") return state; // a refresh: the sign stays up meanwhile
      const connectors = { ...state.connectors };
      if (event.status !== "ready") { if (!connectors[event.id]) return state; delete connectors[event.id]; return { ...state, now, connectors }; }
      const was = connectors[event.id] ?? {};
      connectors[event.id] = { ...was, id: event.id, label: event.label ?? was.label, status: "ready", ...(event.departments ? { departments: event.departments, every_department: !!event.every_department } : {}), ...(event.sign ? { sign: event.sign } : {}), ...(event.roles ? { roles: event.roles } : {}) };
      return { ...state, now, connectors };
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
    case "vaic.visit":
      return { ...state, now, feed: feed(state, `VAIC ${event.kind === "ask" ? "asks" : "checks in with"} ${event.to}`, "worker", now) };
    case "colleague.ask":
      return { ...state, now, feed: feed(state, event.refused ? `${event.from} and ${event.to} have asked each other too much; ${event.from} was told to stop` : `${event.from} asks ${event.to}: ${event.question.slice(0, 60)}`, event.refused ? "fail" : "worker", now) };
    case "colleague.answer":
      return { ...state, now, feed: feed(state, event.answered_by === "ledger" ? `${event.from} got ${event.to}'s record, not an answer` : `${event.to} answers ${event.from}: ${event.answer.slice(0, 60)}`, "worker", now) };
    case "department.created": {
      const was = state.departments[event.name];
      if (was && was.state !== "demolished") return state;
      // The server says which lot it stands on (decision 248): a rebuilt one its old lot if still free, a new one the
      // first free lot or a new one at the edge. From an older server the City picks the same way.
      const slot = Number.isInteger(event.slot) ? event.slot : undefined;
      const lots = slot === undefined || slot in state.lots ? state.lots : { ...state.lots, [slot]: String(event.lot ?? "") };
      const departments = { ...state.departments, [event.name]: { name: event.name, mission: event.mission, manager_id: event.manager_id, state: "active", worker_model: event.worker_model ?? null, slot, builtAt: was?.builtAt ?? now, rebuiltAt: now } };
      return { ...state, now, ...numberLots(departments, lots), feed: feed(state, `Department ${event.name} created`, "department", now) };
    }
    case "department.demolished": {
      // Its lot stands empty for good (decision 248); the record stays until the next snapshot so the scene can play
      // the demolition over it.
      const was = state.departments[event.name];
      if (!was || was.state === "demolished") return state;
      const freed = Number.isInteger(was.slot) ? { ...(state.freed ?? {}), [was.slot]: now } : state.freed; // saplings go in
      return { ...state, now, freed, departments: { ...state.departments, [event.name]: { ...was, state: "demolished", demolishedAt: now } }, feed: feed(state, `Department ${event.name} demolished`, "department", now) };
    }
    case "department.updated": {
      const d = event.department;
      const oldKey = event.previous_key ?? keyOf(d.name);
      const old = Object.values(state.departments).find((x) => keyOf(x.name) === oldKey);
      const departments = { ...state.departments };
      if (old) delete departments[old.name];
      if (d.state !== "deleted") departments[d.name] = { ...d, slot: Number.isInteger(d.slot) ? d.slot : old?.slot, builtAt: old?.builtAt ?? now };
      // A rename moves its members in the ledger without an event of its own.
      const agents = old && old.name !== d.name ? Object.fromEntries(Object.entries(state.agents).map(([id, a]) => [id, a.department && keyOf(a.department) === oldKey ? { ...a, department: d.name } : a])) : state.agents;
      const text = !old?.key ? `Department ${d.name} created` : old.name !== d.name ? `Department ${old.name} is now ${d.name}` : old.state !== d.state ? `Department ${d.name}: ${old.state} → ${d.state}` : `Department ${d.name} updated`;
      return { ...state, now, ...numberLots(departments, state.lots), agents, feed: feed(state, text, "department", now) };
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
// The towers standing (a demolished one is kept until the next snapshot, for its demolition, but it is not a department any more).
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
  // A department's manager always stands at its tower's door (decision 212), dormant, idle or busy; the scene puts
  // him beside the door, never at home and never on a floor (decision 201). Only a retired one has left.
  if (a.kind === "manager" && a.state !== "retired") return { place: "station", dept, why: isReviewing(state, id) ? "reviewing" : hasOpenWork(state, id) ? "ticket" : "manager" };
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

// A released worker stays home as history. Everyone at home is indoors and counted on the roofs (decision 213), so
// all of them are shown; the cap only keeps a very long history from slowing the page.
export const RETIRED_SHOWN = 1000;
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
const SEATS_PER_ROW = 4, STREET = 3;
// How far the countryside and the roads run on past the town on every side, in tiles (the owner: a larger map).
export const MAP_MARGIN = 48;
// How far the world runs on past the town on every side, in tiles (decision 279, the owner: "make the entire map
// larger so I can scroll and drag much further"): forest, with the street past the homes and the avenue past HQ
// running on to its edge. The baked town picture keeps MAP_MARGIN of countryside; the rest is drawn in tiles as it
// comes into view.
export const WORLD_MARGIN = 200;

// The three apartment buildings of a block of homes (decision 188), [kind, x, y, w, h] in tiles inside a box
// APT_BOX_W wide and APT_BOX_H deep: a tall slim brick tower, a wide shorter one at the back, a brownstone mid-rise
// in front, and a courtyard of grass and trees between them. Nothing stands below a door, so everyone walks straight out to the street
// (or the footpath on a phone). Every other block is mirrored, so the town never repeats itself exactly.
const APARTMENTS = [["slim", 0, 0, 3, 9], ["mid", 3, 5, 4, 5], ["wide", 5, 0, 5, 4]];
const APT_BOX_W = 10, APT_BOX_H = 11;
export const HOMES_PER_BLOCK = 24; // eight residents by each building's door
const HOMES_PER_APT = HOMES_PER_BLOCK / APARTMENTS.length;
export const HOUSES = 6, HOUSE_W = 6, HOUSE_H = 5, HOUSE_PITCH = 9; // the suburb (decision 276), in tiles

// A tower's footprint and height in tiles, fixed by its name (decision 166): the skyline is uneven like a real
// one, but a tower still never grows or shrinks with its headcount (decision 117) and never moves. New York close up
// (the owner, decision 271): a tower fills its lot, 10 or 11 of the block's 12 tiles wide, and its lot runs 18 or 19
// tiles deep, over the street behind its 16-tile block (never past it, so no lot overlaps another), so seen from the
// street in front the tower rises over the street behind it.
export function towerSize(name) {
  const h = hashOf(`size:${name}`);
  return { w: 10 + (h % 2), h: 18 + ((h >>> 4) % 2) };
}
// The town is built on a grid of New York blocks (decision 250), the same on a phone and on a Mac or PC: HQ in block
// (0, 0), the homes in the block south of it, every tower in a block of its own, roads around them. Block (c, r) is c
// blocks east and r blocks south of HQ; its corner is at (c * PITCH_X, r * PITCH_Y) tiles, so a block never moves,
// whatever else is built (west and north of HQ are negative). Which blocks get built is organic (the owner,
// 2026-11-12, decisions 259 to 261): every block has a fixed place in one order, by its distance from the middle of
// an oval 1.4 times as wide as it is tall, plus a small seeded jitter, so the town fills outward dense at the centre
// and grows as an oval with a ragged edge ("it should still feel like a city"), never a square or a rectangle.
// Blocks not built yet, and lots whose tower was demolished, are forest.
export const BLOCK_W = 12, BLOCK_H = 16, PITCH_X = BLOCK_W + STREET, PITCH_Y = BLOCK_H + STREET, HQ_DRAW_H = 13;
export const CITY_SEED = "vaic-city-1"; // the town's seed: changing it would move every tower, so it never changes
// Manhattan blocks (decision 275, the owner's references): a block is a row of LOT_W-wide lots side by side, two or
// three of them (seeded per column of blocks, so the avenues run straight but at uneven spacing), with no street
// between neighbours. One lot of each block is a department's (seeded too); the others hold neighbour buildings. The
// column of HQ and the homes is two lots wide: HQ and the homes in its west lot, the avenue past HQ east of it.
export const LOT_W = 12;
export const lotsAcross = (c) => (c === 0 ? 2 : 2 + (hashOf(`${CITY_SEED}:col:${c}`) % 2));
export const colW = (c) => lotsAcross(c) * LOT_W;
const COL_X = new Map([[0, 0]]);
export function colX(c) { // the west edge of block column c, in tiles
  if (!COL_X.has(c)) COL_X.set(c, c > 0 ? colX(c - 1) + colW(c - 1) + STREET : colX(c + 1) - colW(c) - STREET);
  return COL_X.get(c);
}
export const AVENUE_X = colW(0); // the avenue past HQ
const AVENUE_COL = new Map();
export function avenueCol(x) { // the block column whose east side the avenue at x runs along
  if (!AVENUE_COL.size) for (let c = -40; c <= 40; c++) AVENUE_COL.set(colX(c) + colW(c), c);
  return AVENUE_COL.get(x) ?? Math.round((x - AVENUE_X) / (2.5 * LOT_W + STREET));
}
export const deptLot = (c, r) => hashOf(`${CITY_SEED}:dlot:${c},${r}`) % lotsAcross(c); // the department's lot in its block
export const OVAL = 1.4; // the town is an oval, 1.4 times as wide as it is tall (decision 261)
const HOMES_BLOCK = [0, 1], REACH = 24; // blocks are ranked out to REACH blocks from HQ (over 2,000 lots)
const BLOCKS = [];
// How far block (c, r) is from the middle of town, in block heights, on the oval: the density falls with it.
export const blockScore = (c, r) => Math.hypot((colX(c) + colW(c) / 2 - LOT_W) / OVAL, (r - 0.5) * PITCH_Y) / PITCH_Y;
// Packed in rings (decision 282, the owner: "more compressed, an X times X layout. The middle should be the most
// compact… the buildings should still be really tight together"): every lot of a block is a department's, and lot n
// goes, block by block, to the blocks nearest the middle of town (between HQ and the homes, on the avenue side of HQ)
// by a squarish distance in tiles (a 4-norm: rings that are nearly square, X × X), each block filled lot by lot before
// the next, with no randomness: the town fills the central blocks shoulder to shoulder and grows outward a ring at a
// time. HQ and the homes keep their own lots.
const RING_P = 4, MID = { x: LOT_W, y: BLOCK_H + STREET / 2 };
export const lotScore = (c, r, li) => {
  const dx = Math.abs(colX(c) + li * LOT_W + LOT_W / 2 - MID.x), dy = Math.abs(r * PITCH_Y + BLOCK_H / 2 - MID.y);
  return (dx ** RING_P + dy ** RING_P) ** (1 / RING_P);
};
// How far a block's middle is from the middle of town, on the same squarish rings.
// (To the block's nearest edge, so a three-lot block east of HQ counts the same as a two-lot one west of it.)
export const ringScore = (c, r) => {
  const gap = (lo, hi, v) => (v < lo ? lo - v : v > hi ? v - hi : 0);
  const dx = gap(colX(c), colX(c) + colW(c), MID.x), dy = gap(r * PITCH_Y, r * PITCH_Y + BLOCK_H, MID.y);
  return (dx ** RING_P + dy ** RING_P) ** (1 / RING_P);
};
const LOTS = [];
// Lot `slot` → [block column, block row, lot in the block], for good.
// Grown, not drawn with a ruler (decision 286, the owner: "too rectangular… place them randomly while still compact
// around the middle"): the town grows a block at a time from HQ and the homes. The next block is drawn by the town's
// seed from the blocks touching the town so far, each weighted by how near the middle it is (GROW_SCALE tiles per
// halving of its chance), so it stays densest round HQ while its edge comes out on any side, never a rectangle. A
// block is filled lot by lot, nearest first, before the next; the order is fixed by the seed, so it never changes.
const GROW_SCALE = 6, GROW_SEED = `${CITY_SEED}:grow4`; // the seed picked for a town that starts round HQ, not in a line
export function blockOrder() {
  if (!BLOCKS.length) {
    const rand = rngOf(GROW_SEED), taken = new Set(["0,0", `${HOMES_BLOCK[0]},${HOMES_BLOCK[1]}`]), frontier = new Map();
    const touch = (c, r) => { for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${c + dc},${r + dr}`; if (!taken.has(k) && Math.abs(c + dc) <= REACH && Math.abs(r + dr) <= REACH) frontier.set(k, [c + dc, r + dr]); } };
    touch(0, 0); touch(...HOMES_BLOCK);
    while (frontier.size) {
      const options = [...frontier.values()].map(([c, r]) => ({ c, r, w: 2 ** (-ringScore(c, r) / GROW_SCALE) }));
      let x = rand() * options.reduce((a, o) => a + o.w, 0), pick = options[0];
      for (const o of options) { x -= o.w; if (x <= 0) { pick = o; break; } }
      const k = `${pick.c},${pick.r}`;
      frontier.delete(k); taken.add(k); BLOCKS.push([pick.c, pick.r]); touch(pick.c, pick.r);
    }
  }
  return BLOCKS;
}
export function lotOf(slot) {
  if (!LOTS.length) {
    const lotsIn = (c, r) => Array.from({ length: lotsAcross(c) }, (_, li) => li).filter((li) => !(li === 0 && ((c === 0 && r === 0) || (c === HOMES_BLOCK[0] && r === HOMES_BLOCK[1])))).sort((a, b) => lotScore(c, r, a) - lotScore(c, r, b) || a - b);
    // HQ's block and the homes' have a lot each for a department first, then the grown blocks, each filled before the next.
    for (const [c, r] of [[0, 0], HOMES_BLOCK, ...blockOrder()]) for (const li of lotsIn(c, r)) LOTS.push([c, r, li]);
  }
  return LOTS[slot];
}
// Where a tower stands across its lot, in tiles from the lot's west edge: in the middle, except that a tower as wide as
// its lot, on a corner lot by a place that is (or may one day be) a roundabout (decision 290), stands one tile over on
// the far side of its lot, clear of the ring and its pavement. It follows from the place alone, so a tower never moves when a roundabout appears.
export function lotShift(c, r, li, w) {
  const ring = (v, h) => junctionKind(v, h) === "roundabout", mid = Math.floor((LOT_W - w) / 2);
  // Only a tower that would reach the ring from the middle of its lot moves over (one as wide as its lot): it needs
  // RING_FOOT − 24 px (the road's half width) between it and the avenue. Every other tower stays in the middle.
  if (mid * TILE >= RING_FOOT - JUNCTION_HALF) return mid;
  if (li === 0 && (ring(c - 1, r) || ring(c - 1, r - 1))) return LOT_W - w; // the avenue to the west has one at a corner
  if (li === lotsAcross(c) - 1 && (ring(c, r) || ring(c, r - 1))) return 0; // the avenue to the east
  return mid;
}
// Lot `slot` → its block, [column, row].
export const blockOf = (slot) => lotOf(slot).slice(0, 2);

// The lots (decision 248). Every tower stands on a lot of its own, numbered from 0, for good, and lot `s` is always
// block `blockOf(s)`. The server numbers them (the ledger's LOT# items); `numberLots` gives a number to a department
// that has none, the same way: the first lot no standing tower holds (the one nearest HQ), else the next new one. `lots` is { slot: size name }:
// a tower is always as big as `towerSize(size name)` ("" = sized by its number), whoever stands on its lot.
export const lotSizeName = (lots, slot) => lots?.[slot] || `lot:${slot}`;
export function numberLots(departments, lots = {}) {
  const out = { ...departments }, sizes = { ...(lots ?? {}) };
  const recs = Object.values(out).sort((a, b) => (a.builtAt ?? 0) - (b.builtAt ?? 0));
  for (const r of recs) if (Number.isInteger(r.slot) && !(r.slot in sizes)) sizes[r.slot] = "";
  // The first time (no lot numbered yet): in the order the City always drew them, each lot as big as its tower.
  const fresh = !Object.keys(sizes).length;
  const held = new Map();
  for (const r of recs) if (r.state !== "demolished" && Number.isInteger(r.slot) && !held.has(r.slot)) held.set(r.slot, r.name);
  let next = 0;
  for (const r of recs) {
    if (r.state === "demolished" || held.get(r.slot) === r.name) continue;
    while (held.has(next)) next++;
    held.set(next, r.name);
    if (!(next in sizes)) sizes[next] = fresh ? r.name : "";
    out[r.name] = { ...r, slot: next };
  }
  return { departments: out, lots: sizes };
}

// An archived department keeps its lot, so a building never lands on another; it isn't drawn unless work is still open there.
// `seats` is { dept: the highest seat in use + 1 }; it only adds a department the registry no longer lists (the
// towers never grow). `portrait` only says how the camera starts (decision 250: one map everywhere).
export function layout(state, { portrait = false, seats = {}, homes = 0 } = {}) {
  void homes; // one block of homes, always (decision 213)
  const extra = Object.keys(seats).filter((d) => d !== "HQ" && !state.departments[d]); // someone works in a department the registry no longer lists
  const { departments, lots: sizes } = numberLots({ ...state.departments, ...Object.fromEntries(extra.map((d) => [d, { name: d, builtAt: Infinity }])) }, state.lots);
  const holder = new Map(), wrecked = new Map();
  for (const r of Object.values(departments)) {
    if (!Number.isInteger(r.slot)) continue;
    const standing = r.state !== "demolished" || !!seats[r.name];
    if (standing && !holder.has(r.slot)) holder.set(r.slot, r.name);
    else if (!standing) wrecked.set(r.slot, r.name);
  }
  // The town's lots are the ones ever numbered: an empty one is forest (decision 259), and saplings grow back on a lot
  // whose tower came down (`freed`: { slot: when }).
  const top = Math.max(-1, ...Object.keys(sizes).map(Number), ...holder.keys(), ...wrecked.keys()) + 1;
  const corner = (c, r) => ({ x: colX(c), y: r * PITCH_Y });
  const buildings = [], lots = [];
  let c0 = -1, c1 = 1, r0 = -1, r1 = 1; // the map reaches at least one block around HQ
  const built = new Set(["0,0", `${HOMES_BLOCK[0]},${HOMES_BLOCK[1]}`]); // blocks with a road along them
  for (let slot = 0; slot < top; slot++) {
    const [c, r, li] = lotOf(slot), o = corner(c, r), s = towerSize(lotSizeName(sizes, slot));
    // Roads only round blocks with a tower standing on them (decision 286): a block whose lots are all free is forest
    // with no road round it, until a department takes one of them.
    if (holder.has(slot)) { built.add(`${c},${r}`); c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
    const lx = o.x + li * LOT_W, x = lx + lotShift(c, r, li, s.w), y = o.y + BLOCK_H - s.h; // its lot, on the street side of its block
    const name = holder.get(slot);
    if (!name) {
      const freedAt = state.freed?.[slot];
      lots.push({ x, y, w: s.w, h: s.h, slot, block: { x: lx, y: o.y, w: LOT_W, h: BLOCK_H }, ...(Number.isFinite(freedAt) ? { freedAt } : {}), ...(wrecked.has(slot) ? { demolished: wrecked.get(slot) } : {}) });
      continue;
    }
    const reg = state.departments[name];
    buildings.push({ dept: name, slot, x, y, w: s.w, h: s.h, lot: { x: lx, y: o.y, w: LOT_W, h: BLOCK_H }, color: deptColor(name), builtAt: reg?.builtAt ?? 0, archived: reg?.state === "archived" && !seats[name] });
  }
  // The roads (decision 259): only where the town is. A street runs along the blocks built on either side of it, and
  // on to the avenue past HQ, so every door reaches it; an avenue runs along the blocks built on either side of it.
  // The avenue past HQ and the street between HQ and the homes run right through the map and on into the countryside,
  // where the cabs come from. The town only ever grows, so a road, once there, stays.
  const left = colX(c0) - STREET, topY = r0 * PITCH_Y - STREET, width = colX(c1) + colW(c1) + STREET, height = (r1 + 1) * PITCH_Y;
  const streets = [], lanes = [];
  const isBuilt = (c, r) => built.has(`${c},${r}`);
  for (let r = r0 - 1; r <= r1; r++) {
    const y = r * PITCH_Y + BLOCK_H;
    if (r === 0) { streets.push({ y, x0: left, x1: width }); continue; }
    let x0 = Infinity, x1 = -Infinity;
    for (let c = c0; c <= c1; c++) if (isBuilt(c, r) || isBuilt(c, r + 1)) { x0 = Math.min(x0, colX(c) - STREET); x1 = Math.max(x1, colX(c) + colW(c) + STREET); }
    if (x0 < Infinity) streets.push({ y, x0: Math.min(x0, AVENUE_X), x1: Math.max(x1, AVENUE_X + STREET) });
  }
  for (let c = c0 - 1; c <= c1; c++) {
    if (c === 0) continue; // the avenue past HQ, below
    let y0 = Infinity, y1 = -Infinity;
    for (let r = r0; r <= r1; r++) if (isBuilt(c, r) || isBuilt(c + 1, r)) { y0 = Math.min(y0, r * PITCH_Y - STREET); y1 = Math.max(y1, (r + 1) * PITCH_Y); }
    if (y0 < Infinity) lanes.push({ x: colX(c) + colW(c), y0, y1 });
  }
  // No neighbours any more (decision 279, the owner: "remove all buildings that are not a department"): a block's
  // other lots are small parks of trees between the towers.
  const neighbours = [];
  const blocks = [...built].map((k) => { const [c, r] = k.split(",").map(Number); return { x: colX(c), y: r * PITCH_Y, w: colW(c), h: BLOCK_H, c, r }; });
  const hq = { dept: "HQ", x: 0, y: BLOCK_H - HQ_DRAW_H, w: LOT_W, h: HQ_DRAW_H, color: DEPT_COLOR.HQ };
  // The homes (decision 188): one block of three apartment buildings at the foot of its block, a small park behind.
  const hb = corner(...HOMES_BLOCK), apartments = [], houses = [], homeBlocks = [{ x: hb.x, y: hb.y + BLOCK_H - APT_BOX_H, w: BLOCK_W, h: APT_BOX_H, mirror: false }];
  const off = Math.floor((BLOCK_W - APT_BOX_W) / 2);
  for (const [kind, ax, ay, aw, ah] of APARTMENTS) apartments.push({ kind, block: 0, x: hb.x + off + ax, y: hb.y + BLOCK_H - APT_BOX_H + ay, w: aw, h: ah });
  // The suburb (decision 276, the owner: "placeholder houses, outside the town… they have to take the cab to the
  // town"): HOUSES small houses on the street between HQ and the homes, just past the town's edge on either side,
  // facing the street, where some residents live and ride a cab in. Placeholders: they keep just outside the town,
  // so they move out with its edge as it grows.
  for (let i = 0; i < HOUSES; i++) {
    const west = i % 2 === 0, k = Math.floor(i / 2);
    houses.push({ kind: "house", block: -1, x: west ? left - 4 - (k + 1) * HOUSE_PITCH : width + 4 + k * HOUSE_PITCH, y: BLOCK_H - HOUSE_H, w: HOUSE_W, h: HOUSE_H });
  }
  const parks = [{ x: hb.x, y: hb.y, w: BLOCK_W, h: BLOCK_H - APT_BOX_H }];
  return { hq, buildings, lots, neighbours, blocks, lanes, streets, hqStreet: BLOCK_H, officesEnd: height - STREET, avenue: AVENUE_X, left, top: topY, width, height, homes: { x: hb.x, y: hb.y, w: BLOCK_W, h: BLOCK_H, apartments, houses, blocks: homeBlocks, paths: [], parks }, portrait };
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

// Which apartment building a home slot is in: the slots take turns between a block's three buildings.
// The neighbourhood never grows past the blocks it has (decision 213): later slots share the same buildings, their
// windows already lit, and the count on the roof says how many are home.
export function homeOf(world, slot) {
  // Every fourth resident lives in a house in the suburb (decision 276), the rest in the apartment buildings.
  const houses = world.homes.houses ?? [];
  if (houses.length && slot % 4 === 3) return houses[Math.floor(slot / 4) % houses.length];
  const blocks = Math.max(1, world.homes.blocks.length);
  const b = Math.floor(slot / HOMES_PER_BLOCK) % blocks, k = slot % HOMES_PER_BLOCK;
  return world.homes.apartments[b * APARTMENTS.length + (k % APARTMENTS.length)] ?? null;
}
// Where a resident stands: on the pavement by its building's door, nearest first, in two rows of four.
const STAND = [-7, 7, -19, 19];
export function homeSpot(world, slot) {
  const a = homeOf(world, slot);
  if (!a) return null;
  const j = a.kind === "house" ? Math.floor(slot / 4 / Math.max(1, (world.homes.houses ?? []).length)) % 4 : Math.floor((slot % HOMES_PER_BLOCK) / APARTMENTS.length) % HOMES_PER_APT;
  const d = doorOf(a);
  return { x: d.x + STAND[j % 4], y: (a.y + a.h) * TILE + 6 + Math.floor(j / 4) * 8, inside: true }; // at home: indoors (decision 213)
}

// An evening walk keeps to the streets: to the nearest street, along it to the avenue, along the avenue, and in.
export function walkRoute(world, from, to) {
  const lanes = [...world.streets.map((s) => (s.y + STREET / 2) * TILE), ...(world.homes.paths ?? [])];
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
export const visitAllowed = (lastAt, now, to) => to !== "vaic" && now - lastAt >= 1000;

export const currentTicket = (state, id) => Object.values(state.tickets).filter((t) => t.to === id).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0] ?? null;

export function agentPanel(state, id, audit = []) {
  const a = state.agents[id];
  if (!a) return null;
  const t = currentTicket(state, id);
  const today = state.costs[id];
  return {
    id, role: roleOf(a), kind: a.kind, executor: a.executor ?? null, lastTicket: state.recent[id]?.ticket ?? null, model: a.model, modelName: MODEL_NAME[a.model] ?? a.model, modelColor: MODEL_COLOR[a.model] ?? "#ccc", department: deptOf(a), parent: a.parent,
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

// Who is working in each department's building right now (decision 279, the owner: windows lit "only … if there are
// people working inside… working on a project inside that department"): its workers on a job (working or
// reporting, as "Agents working now" counts them) and its manager while a ticket of theirs is in progress. One lit
// window each; none working, the building is dark. { dept: [{ id, what }] }, `what` the job's title where known.
export function workingIn(state) {
  const out = {};
  for (const a of Object.values(state.agents)) {
    if (CORE.has(a.id) || a.kind === "core" || a.kind === "specialist" || a.state === "retired") continue;
    const on = a.kind === "worker" ? BUSY.has(a.worker_state) : a.kind === "manager" && Object.values(state.tickets).some((t) => t.to === a.id && t.status === "in_progress");
    if (!on) continue;
    const dept = deptOf(a), t = currentTicket(state, a.id);
    (out[dept] ??= []).push({ id: a.id, what: t?.title ?? t?.goal ?? null });
  }
  return out;
}
// How many agents stand at work in a department building (not HQ).
export const agentsAtWork = (state) => Object.values(state.agents).filter((a) => !CORE.has(a.id) && a.kind !== "core" && placement(state, a.id).place === "station").length;

// Running right now: a worker waiting for an answer or whose work is in review is not working (the owner,
// 2026-11-09: the counter showed 1 while no job ran).
const BUSY = new Set(["working", "reporting"]);
/** Workers on a job right now: the number the owner asked for when they set how many agents a task gets. */
export const workersWorking = (state) =>
  Object.values(state.agents).filter((a) => a.kind === "worker" && a.state !== "retired" && BUSY.has(a.worker_state)).length;

export function topBar(state) {
  const agents = Object.values(state.agents).filter((a) => !CORE.has(a.id) && a.kind !== "specialist" && !a.standin); // a stand-in manager is drawn, not hired
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
export const ANIM_MS = { rise: 900, build: 3200, demolish: 2600, focus: 700, ghost: Infinity };
export const RISE_STAGGER_MS = 110, FOCUS_STAGGER_MS = 45;
// Where a building animation is: 0 … 1 (clamped), from its start and its kind.
export const animProgress = (anim, now) => Math.max(0, Math.min(1, (now - anim.start) / (anim.dur ?? ANIM_MS[anim.kind] ?? 1000)));
// The page-load entrance: every tower rises in turn, left to right and front to back (its slot order). A tower that
// stood as a blurred placeholder while the city loaded (`ghosts`, decision 249) comes into focus where it stands instead.
export function entranceAnims(buildings, start, ghosts = new Set()) {
  return [...buildings].filter((b) => !b.archived).sort((a, b) => a.slot - b.slot).map((b, i) => {
    const kind = ghosts.has(b.dept) ? "focus" : "rise";
    return { dept: b.dept, kind, start: start + i * (kind === "focus" ? FOCUS_STAGGER_MS : RISE_STAGGER_MS), dur: ANIM_MS[kind] };
  });
}

// What the City remembers between visits so it can draw itself before the server answers (decision 249): only where
// the towers stand (each standing department's name and lot, and the lots' sizes), nothing else.
export function lotsMemory(state) {
  return {
    departments: Object.values(state.departments).filter((d) => d.state !== "demolished" && Number.isInteger(d.slot)).map((d) => ({ name: d.name, slot: d.slot, state: d.state ?? "active" })),
    lots: Object.entries(state.lots ?? {}).map(([slot, size]) => ({ slot: Number(slot), size })),
  };
}
export function readLotsMemory(raw) {
  try {
    const v = JSON.parse(raw ?? "null");
    if (!v || !Array.isArray(v.departments) || !Array.isArray(v.lots)) return null;
    const departments = v.departments.filter((d) => typeof d?.name === "string" && Number.isInteger(d.slot)).map((d) => ({ name: d.name, slot: d.slot, state: d.state === "archived" ? "archived" : "active" }));
    const lots = v.lots.filter((l) => Number.isInteger(l?.slot) && typeof l.size === "string").map((l) => ({ slot: l.slot, size: l.size }));
    return { departments, lots };
  } catch {
    return null;
  }
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

// A cab's opacity: it fades in over the last stretch of road at the map's faded border and out over the same
// stretch on its way off it, so it never appears or vanishes in the middle of a road (decision 267: only at the edge).
export const CAB_FADE_PX = 6 * TILE;
export function edgeAlpha(pos, from, to) {
  return Math.max(0, Math.min(1, Math.min(pos - from, to - pos) / CAB_FADE_PX));
}
// The owner's two rare cars (the owner, 2026-11-12; decision 191 had counted every 50th car): each car that enters
// the road rolls once, on its own: 1 in 50 it is the owner's Porsche-style coupé (black, chrome rims), 1 in 50 it is
// the Lamborghini-style supercar (a matte black wedge, a big wing, red Y tail lights), never both, otherwise a cab
// (same lanes, fade, roof light and passengers). The roll is seedable (`sim.rareRand`, its own stream so the traffic
// itself never changes) so a test can force either car; a cruising cab rolls each time it comes round again and a
// commuter's cab when it is hailed. `rareCar(u)` maps one draw in [0, 1) to the car.
export const RARE_CAB_ODDS = 50;
export const RARE_CARS = ["porsche", "lambo"];
export function rareCar(u) {
  const k = Math.floor(u * RARE_CAB_ODDS);
  return k < RARE_CARS.length ? RARE_CARS[k] : false;
}
export function arrive(sim) {
  sim.arrivals = (sim.arrivals ?? 0) + 1;
  return rareCar((sim.rareRand ?? Math.random)());
}
// ---------- Traffic (decision 176): signals at some junctions, give way at the rest, a couple of roundabouts, and
// the open road outside the town driven at highway speed. A small simulation stepped by the scene's clock: every
// cab follows the one in front, brakes for red and amber at the stop line, gives way, circles a roundabout and
// takes its exit. The owner's rare cars (either one) run the lights; it still never drives into anyone.
// How many cabs cruise each lane: one per 44 tiles of road (decision 180, the first halving; was 22), then halved
// again across the whole map (decision 191): exactly half of that total, at least one per lane, the rest going to
// the lanes that had the most.
export const CAB_PX_S = 34, CAB_GAP_PX = 44 * TILE, CAB_SHARE = 0.5;
export function cabsPerLane(spans) {
  const was = spans.map((s) => Math.max(1, Math.round(s / CAB_GAP_PX)));
  const want = was.map((n) => n * CAB_SHARE), out = want.map((w) => Math.max(1, Math.floor(w)));
  const total = Math.max(spans.length, Math.round(was.reduce((a, b) => a + b, 0) * CAB_SHARE));
  const order = want.map((w, i) => [w - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0, sum = out.reduce((a, b) => a + b, 0); sum < total; k = (k + 1) % order.length, sum++) out[order[k][1]] += 1;
  return out;
}
export const CAB_KEEP = 0.75; // the share of those that drive (decision 269)
export const FAR_PX_S = 220;
export const TOWN_PX_S = CAB_PX_S, HIGHWAY_PX_S = 96, RING_PX_S = 22, ACCEL_PX_S2 = 44, BRAKE_PX_S2 = 50, CAR_GAP_PX = 6;
// A roundabout (decision 290): the cabs circle at RING_R, the ring road reaches 32 px, its pavement RING_FOOT − 2;
// nothing is built within RING_FOOT of a roundabout's centre (decision 252 had made it 40, drawn out to 64, which cut
// into the corners of the blocks round it and under their towers).
export const RING_FOOT = 40;
export const JUNCTION_HALF = 24, STOP_AT = 36, RING_R = 24; // (was 40: a roundabout twice the size it was, so the circling shows (decision 252)
const CAR_LEN = { x: 24, y: 18 }, RING_LEN = 20, LOOKAHEAD = 420, TAU = Math.PI * 2;
// A light: green, amber, then a moment of red both ways before the crossing road goes green. Red lasts 5 s.
export const SIGNAL_MS = { green: 3600, amber: 900, allRed: 250 };
export const SIGNAL_CYCLE_MS = 2 * (SIGNAL_MS.green + SIGNAL_MS.amber + SIGNAL_MS.allRed);
export const RED_MS = SIGNAL_CYCLE_MS - SIGNAL_MS.green - SIGNAL_MS.amber;
// `x` is the street traffic (east and west), `y` the avenue traffic (north and south).
export function signalAt(junction, t) {
  const { green: G, amber: A, allRed: X } = SIGNAL_MS, half = G + A + X;
  const p = ((((t + (junction.offset ?? 0)) % SIGNAL_CYCLE_MS) + SIGNAL_CYCLE_MS) % SIGNAL_CYCLE_MS);
  const q = p < half ? p : p - half, go = q < G ? "green" : q < G + A ? "amber" : "red";
  return p < half ? { x: go, y: "red" } : { x: "red", y: go };
}

// The roads that run north–south right through the map: the avenue and, when there are towers west of HQ, the road
// west of HQ (in tiles). The short side streets between towers carry no traffic.
export function throughRoads(world) {
  const top = (world.top ?? 0) - WORLD_MARGIN;
  return [{ x: world.avenue, y0: top, y1: world.height + WORLD_MARGIN }, ...(world.lanes ?? [])]; // every avenue carries cabs (decision 259)
}
// Each street has two lanes, westbound above the centre line and eastbound below it; each through road has two,
// southbound on the left and northbound on the right. A road either runs out through the countryside to the map's
// faded border (`off0`/`off1`: that end is off the map), where cabs arrive from beyond the edge and drive off beyond
// it, or ends at a crossing (a T or a corner), where its lanes end at the crossing's centre and a cab turns onto the
// other road (decision 267). No lane ends anywhere else.
export function streetLanes(world) {
  const M = WORLD_MARGIN * TILE, L = world.left ?? 0, x0 = L * TILE - M, x1 = world.width * TILE + M;
  return world.streets.map((s) => {
    const off0 = s.y === world.hqStreet, off1 = off0; // only the street between HQ and the homes runs off the map
    return { y0: s.y * TILE + 17, y1: s.y * TILE + 33, x0: off0 ? x0 : (s.x0 + STREET / 2) * TILE, x1: off1 ? x1 : (s.x1 - STREET / 2) * TILE, off0, off1 };
  });
}
export function avenueLanes(world) {
  const top = (world.top ?? 0) - WORLD_MARGIN, bottom = world.height + WORLD_MARGIN;
  return throughRoads(world).map((r) => {
    const off0 = r.y0 <= top, off1 = r.y1 >= bottom;
    return { x0: r.x * TILE + 18, x1: r.x * TILE + 30, y0: off0 ? r.y0 * TILE : (r.y0 + STREET / 2) * TILE, y1: off1 ? r.y1 * TILE : (r.y1 - STREET / 2) * TILE, off0, off1 };
  });
}
// Every crossing of a street and a through road. What each one is follows from where it is, never from how big the
// town is (decision 252), so a new tower, a demolished one or a new road never changes a crossing: lights at the six
// around HQ and the homes; roundabouts scattered at random (decision 259: about one crossing in three or four, seeded
// by the town's seed, never two next to each other, diagonals included), so the town gets more of them as it grows; elsewhere
// the street gives way to the avenue.
const roundHash = (v, h) => hashOf(`${CITY_SEED}:round:${v},${h}`);
const isLight = (v, h) => (v === -1 || v === 0) && h >= -1 && h <= 1;
const roundCandidate = (v, h) => !isLight(v, h) && roundHash(v, h) % 3 === 0;
export function junctionKind(v, h) {
  if (isLight(v, h)) return "light";
  if (!roundCandidate(v, h)) return "giveway";
  // The candidate with the lowest number among its near neighbours wins; the others give way.
  for (let dv = -2; dv <= 2; dv++) for (let dh = -2; dh <= 2; dh++) {
    if ((!dv && !dh) || Math.abs(dv) > 1 || Math.abs(dh) > 1 || !roundCandidate(v + dv, h + dh)) continue;
    const mine = roundHash(v, h), theirs = roundHash(v + dv, h + dh);
    if (theirs < mine || (theirs === mine && (dv < 0 || (dv === 0 && dh < 0)))) return "giveway";
  }
  return "roundabout";
}
// Each crossing also says which of its four arms are road (`arms`: w, e, n, s): a T has three, a corner two. A
// roundabout only ever sits on a crossing with all four (decision 267): its ring needs a road out on every side, so a T
// or a corner where the seed would put one gives way instead, and becomes the roundabout only once the town has grown
// the fourth road (roads only grow, so it never turns back).
export function junctions(world) {
  const roads = throughRoads(world), list = [];
  world.streets.forEach((s, street) => roads.forEach((r, road) => {
    if (r.y0 > s.y || r.y1 < s.y + STREET || s.x0 > r.x || s.x1 < r.x + STREET) return; // both roads reach the crossing
    // The avenue east of block column v and the street south of block row h (decision 250's grid).
    const v = avenueCol(r.x), h = Math.round((s.y - BLOCK_H) / PITCH_Y);
    const off = s.y === world.hqStreet; // the street between HQ and the homes runs on off the map
    const arms = { w: s.x0 < r.x || off, e: s.x1 > r.x + STREET || off, n: r.y0 < s.y, s: r.y1 > s.y + STREET };
    const four = arms.w && arms.e && arms.n && arms.s, kind = junctionKind(v, h);
    list.push({ id: `j${v},${h}`, street, road, v, h, arms, kind: kind === "roundabout" && !four ? "giveway" : kind, cx: (r.x + STREET / 2) * TILE, cy: (s.y + STREET / 2) * TILE });
  }));
  for (const j of list) if (j.kind === "light") j.offset = hashOf(j.id) % SIGNAL_CYCLE_MS;
  return list;
}

// The yellow centre lines (decision 269): one run per stretch of road between junctions, ending at the junction's
// edge (a roundabout's ring), except that the road which runs on through a T keeps its line through it; and at a
// corner, where both roads end, a quarter-circle joining the two lines, so the line bends round the turn. In pixels:
// `runs` [{ axis, at, from, to, cap0, cap1 }] (`cap`: that end meets a junction, "bend" a corner's bend, or false) and `bends` [{ cx, cy, r, from, to }]
// (`from`/`to` the points where the bend meets each road's run).
export const BEND_R = 24;
export function centreLines(world) {
  const js = junctions(world), runs = [], bends = [], H = BEND_R;
  const M = WORLD_MARGIN, L = world.left ?? 0;
  const cut = (axis, at, from, to, stops) => {
    let a = from, capA = false;
    for (const st of stops.sort((p, q) => p.c - q.c)) {
      if (st.c + st.half <= a || st.c - st.half >= to) continue;
      if (st.c - st.half - a >= 1) runs.push({ axis, at, from: a, to: st.c - st.half, cap0: capA, cap1: st.cap });
      a = Math.max(a, st.c + st.half); capA = st.cap;
    }
    if (to - a >= 1) runs.push({ axis, at, from: a, to, cap0: capA, cap1: false });
  };
  const half = (j) => (j.kind === "roundabout" ? RING_FOOT : H);
  const corner = (j) => [j.arms.w, j.arms.e, j.arms.n, j.arms.s].filter(Boolean).length === 2 && !(j.arms.w && j.arms.e) && !(j.arms.n && j.arms.s);
  const stop = (j, c) => ({ c, half: half(j), cap: corner(j) ? "bend" : "junction" });
  world.streets.forEach((st, i) => {
    const off = st.y === world.hqStreet, x0 = (off ? L - M : st.x0) * TILE, x1 = (off ? world.width + M : st.x1) * TILE;
    const through = (j) => j.arms.w && j.arms.e && !(j.arms.n && j.arms.s) && j.kind !== "roundabout";
    cut("x", (st.y + STREET / 2) * TILE, x0, x1, js.filter((j) => j.street === i && !through(j)).map((j) => stop(j, j.cx)));
  });
  throughRoads(world).forEach((r, i) => {
    const through = (j) => j.arms.n && j.arms.s && !(j.arms.w && j.arms.e) && j.kind !== "roundabout";
    cut("y", (r.x + STREET / 2) * TILE, r.y0 * TILE, r.y1 * TILE, js.filter((j) => j.road === i && !through(j)).map((j) => stop(j, j.cy)));
  });
  for (const j of js) {
    if (!corner(j)) continue; // a corner: one road each way
    const a = j.arms;
    const h = a.w ? -1 : 1, v = a.n ? -1 : 1;
    bends.push({ cx: j.cx + h * H, cy: j.cy + v * H, r: H, from: { x: j.cx + h * H, y: j.cy }, to: { x: j.cx, y: j.cy + v * H }, j: j.id });
  }
  return { runs, bends };
}

// Footbridges (the owner, 2026-11-12, decision 262): a few places where the sidewalk arches over the road and the
// cabs drive under it. Only ever halfway along a block (never at a junction, so lights, roundabouts and giving way
// are untouched), only inside the town, and only where the town's seed says so (about one block side in eleven), so
// a bridge, once there, stays. Each is { x, y } in pixels at the middle of the road and `across`: "y" for a bridge over
// a street (it runs north–south), "x" for one over an avenue. Cabs and commuters never stop for one.
export function footbridges(world) {
  const out = [], L = world.left ?? 0, T = world.top ?? 0;
  // Only over the avenues (decision 271): a tower now rises over the street behind it, so a bridge over a street
  // would land on the back of the tower in front.
  for (const l of world.lanes ?? []) {
    const v = avenueCol(l.x);
    for (let r = Math.ceil(Math.max(l.y0, T) / PITCH_Y) - 1; r * PITCH_Y + BLOCK_H <= Math.min(l.y1, world.height); r++) {
      const mid = r * PITCH_Y + BLOCK_H / 2;
      if (mid - 2 < Math.max(l.y0, T) || mid + 2 > Math.min(l.y1, world.height)) continue;
      if (hashOf(`${CITY_SEED}:bridge:a${v},${r}`) % 5 === 0) out.push({ x: (l.x + STREET / 2) * TILE, y: mid * TILE, across: "x" });
    }
  }
  return out;
}

// A lane: travel coordinate `d` from 0 at the lane's start to `span` at its end.
const posOf = (lane, d) => (lane.dir > 0 ? lane.from + d : lane.to - d);
const dOf = (lane, p) => (lane.dir > 0 ? p - lane.from : lane.to - p);
const lanePoint = (lane, d) => (lane.axis === "x" ? { x: posOf(lane, d), y: lane.at } : { x: lane.at, y: posOf(lane, d) });
const reach = (vEnd, dist) => Math.sqrt(Math.max(0, vEnd) ** 2 + 2 * BRAKE_PX_S2 * Math.max(0, dist)); // the fastest one can go and still slow to vEnd in dist
const ringArc = (from, to) => (((from - to) % TAU) + TAU) % TAU * RING_R; // along the ring (angle decreasing: anticlockwise on screen)

// The traffic (decision 267): every cab drives in from beyond the map's edge on a road that runs off it, and out
// again the same way; nowhere else does one appear or vanish. A road that ends at a T or a corner ends at that
// crossing, and a cab reaching its end turns onto the other road there (giving way, or on its green) once there is room.
// A cab that drives off the map comes back in a moment later on one of the roads that run in from the edge.
// `warmMs` runs the traffic for that long first (from every cab beyond the edge), so the town opens with its cabs
// already out on the roads.
export const WARM_MS = 90000;
export function createTraffic(world, seed = "traffic", rareSeed, { warmMs = 0 } = {}) {
  const M = MAP_MARGIN * TILE, W = world.width * TILE, H = world.height * TILE, lanes = [];
  // `startOff`: the lane begins off the map (cabs come in on it); `endOff`: it ends off the map (cabs leave on it).
  streetLanes(world).forEach((l, i) => {
    lanes.push({ id: `e${i}`, axis: "x", dir: 1, at: l.y1, from: l.x0, to: l.x1, street: i, startOff: l.off0, endOff: l.off1 });
    lanes.push({ id: `w${i}`, axis: "x", dir: -1, at: l.y0, from: l.x0, to: l.x1, street: i, startOff: l.off1, endOff: l.off0 });
  });
  avenueLanes(world).forEach((l, i) => {
    lanes.push({ id: `s${i}`, axis: "y", dir: 1, at: l.x0, from: l.y0, to: l.y1, road: i, startOff: l.off0, endOff: l.off1 });
    lanes.push({ id: `n${i}`, axis: "y", dir: -1, at: l.x1, from: l.y0, to: l.y1, road: i, startOff: l.off1, endOff: l.off0 });
  });
  const js = junctions(world);
  for (const lane of lanes) {
    lane.span = lane.to - lane.from; lane.len = CAR_LEN[lane.axis];
    const [lo, hi] = lane.axis === "x" ? [(world.left ?? 0) * TILE, W] : [(world.top ?? 0) * TILE, H], a = dOf(lane, lo), b = dOf(lane, hi);
    lane.townFrom = Math.min(a, b); lane.townTo = Math.max(a, b);
    // Out past MAP_MARGIN (the far countryside, decision 279) a cab drives at FAR_PX_S, so the bigger world doesn't
    // keep it away from town for long.
    const nm = MAP_MARGIN * TILE, na = dOf(lane, lo - nm), nb = dOf(lane, hi + nm);
    lane.nearFrom = Math.min(na, nb); lane.nearTo = Math.max(na, nb);
    lane.controls = [];
    for (const j of js) {
      if (lane.axis === "x" ? lane.street !== j.street : lane.road !== j.road) continue;
      const dc = dOf(lane, lane.axis === "x" ? j.cx : j.cy), off = lane.at - (lane.axis === "x" ? j.cy : j.cx), half = Math.sqrt(RING_R ** 2 - off ** 2);
      const c = { j, dc, entryD: dc - half, exitD: dc + half };
      const ang = (d) => { const p = lanePoint(lane, d); return Math.atan2(p.y - j.cy, p.x - j.cx); };
      c.entryAng = ang(c.entryD); c.exitAng = ang(c.exitD);
      lane.controls.push(c);
    }
    lane.controls.sort((p, q) => p.dc - q.dc);
    // A lane that ends at a crossing: the crossing it ends at.
    lane.endJ = lane.endOff ? null : (lane.controls.find((c) => Math.abs(c.dc - lane.span) < 1)?.j ?? null);
  }
  // How many: as many as the roads out to MAP_MARGIN carry (the far countryside adds none, decision 279).
  const cars = [], counts = cabsPerLane(lanes.map((l) => Math.min(l.span, l.nearTo) - Math.max(0, l.nearFrom)));
  const sim = { world, lanes, junctions: js, cars, guests: [], t: 0, rand: rngOf(seed), margin: M, arrivals: 0, rareRand: rngOf(`rare:${seed}:${rareSeed ?? Math.floor(Math.random() * 2 ** 31)}`) };
  sim.entries = lanes.filter((l) => l.startOff);
  // Every cab starts beyond the map's edge, queued on the roads that come in from it.
  let k = 0;
  // Three in four of them (the owner, 2026-11-12, decision 269: "way too many cabs… 75% of what we have").
  const keep = Math.round(counts.reduce((a, b) => a + b, 0) * CAB_KEEP);
  for (const [li, lane] of lanes.entries()) for (let n = 0; n < counts[li] && k < keep; n++, k++) {
    const id = `${lane.id}:${n}`, f = 0.88 + (hashOf(`pace:${id}`) % 25) / 100;
    const car = { id, lane: null, d: 0, v: HIGHWAY_PX_S * f, f, lap: 0, rare: false, commit: null, stopFor: null, ring: null, braking: false };
    cars.push(car);
    comeIn(sim, car, sim.entries[k % sim.entries.length]);
  }
  for (let t = 0; t < warmMs; t += 1000) stepTraffic(sim, 1000);
  return sim;
}
// A cab comes in from beyond the edge on `lane` (one that starts off the map), behind the last one queued there.
function comeIn(sim, car, lane) {
  const behind = sim.cars.reduce((m, o) => (o !== car && o.lane === lane && !o.ring ? Math.min(m, o.d) : m), Infinity);
  car.lane = lane; car.ring = null; car.turn = null; car.commit = null; car.stopFor = null; car.next = null; car.decided = null; car.turnedAt = null;
  car.d = Math.min(0, behind - lane.len - CAR_GAP_PX - 40);
  car.v = HIGHWAY_PX_S * car.f;
  car.rare = arrive(sim);
}
// Where a cab at the end of `lane` (which ends at crossing `j`) may turn: the other road's lanes leading away from
// the crossing; back down its own road the other way only if there is nothing else.
function turnsAt(sim, lane, j) {
  const away = (l) => { const c = l.controls.find((k) => k.j === j); return c && c.dc < l.span - 1 ? { l, c } : null; };
  const other = sim.lanes.filter((l) => l.axis !== lane.axis).map(away).filter(Boolean);
  return other.length ? other : sim.lanes.filter((l) => l !== lane && l.axis === lane.axis && (l.axis === "x" ? l.street === lane.street : l.road === lane.road)).map(away).filter(Boolean);
}
// Room on lane `l` at crossing `c` for a cab turning in: nobody in the way just past the turn, nor coming up to it.
const roomAt = (sim, l, c, self) => !sim.cars.some((o) => o !== self && o.lane === l && !o.ring && o.d > c.dc - 40 && o.d < c.dc + l.len + CAR_GAP_PX + 4);
const rngOf = (seed) => { let x = hashOf(seed) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; };

// The roads changed (a new tower, decision 267): the new traffic takes over the cabs already out on the old roads, each
// where it is on the lane that runs the same way through the same spot (every old road is still there: roads only
// grow), so nothing on screen jumps. Cabs that find no lane, or are more than the new roads carry, go off beyond the
// edge and come back in; the new roads' extra cabs come in from the edge.
export function carryTraffic(next, prev) {
  if (!prev) return next;
  const keep = [];
  for (const o of prev.cars) {
    if (o.ring) {
      const j = next.junctions.find((k) => k.id === o.ring.j.id && k.kind === "roundabout"), toLane = j && next.lanes.find((l) => l.axis === o.ring.toLane.axis && l.dir === o.ring.toLane.dir && l.at === o.ring.toLane.at && l.controls.some((c) => c.j === j));
      if (toLane) { keep.push({ ...o, ring: { ...o.ring, j, toLane, toD: toLane.controls.find((c) => c.j === j).exitD }, next: null, decided: null }); continue; }
    } else if (o.lane && o.d >= 0 && o.d <= o.lane.span) {
      const p = lanePoint(o.lane, o.d), at = o.lane.axis === "x" ? p.x : p.y;
      const l = next.lanes.find((k) => k.axis === o.lane.axis && k.dir === o.lane.dir && k.at === o.lane.at && at >= k.from - 0.5 && at <= k.to + 0.5);
      if (l) { keep.push({ ...o, lane: l, d: dOf(l, at), next: null }); continue; }
    }
  }
  const out = keep.slice(0, next.cars.length);
  for (const c of next.cars) { if (out.length >= next.cars.length) break; while (out.some((k) => k.id === c.id)) c.id += "'"; out.push(c); }
  next.cars.splice(0, next.cars.length, ...out);
  next.t = prev.t;
  return next;
}

// Advances the traffic by dtMs (in steps of at most 50 ms; a long pause, a hidden tab, is cut to a second).
export function stepTraffic(sim, dtMs) {
  let left = Math.min(Math.max(0, dtMs), 1000);
  while (left > 0) { const h = Math.min(50, left); tick(sim, h / 1000); sim.t += h; left -= h; }
}

function tick(sim, dt) {
  const byLane = new Map(sim.lanes.map((l) => [l, []])), byRing = new Map();
  for (const c of sim.cars) {
    if (c.ring) { if (!byRing.has(c.ring.j)) byRing.set(c.ring.j, []); byRing.get(c.ring.j).push(c); }
    else byLane.get(c.lane).push(c);
  }
  for (const list of byLane.values()) list.sort((a, b) => a.d - b.d);
  // A roundabout takes three cars at a time, counting the ones already let on.
  const load = new Map();
  for (const c of [...sim.cars, ...guestsOf(sim)]) { const j = c.ring?.j ?? (c.commit && sim.junctions.find((k) => k.id === c.commit && k.kind === "roundabout")); if (j) load.set(j, (load.get(j) ?? 0) + 1); }
  // Who is inside a junction's box right now, and on which axis.
  const inBox = (j, axis) => guestInBox(sim, j, axis) || sim.lanes.some((l) => l.axis === axis && l.controls.some((c) => c.j === j && byLane.get(l).some((o) => Math.abs(o.d - c.dc) < JUNCTION_HALF + l.len / 2)));
  // A car on the given axis is in the junction or will be within about two seconds.
  // (A cab waiting at the end of its road to turn is not coming through until it is over its line: the road it ends
  // on goes first.)
  const approaching = (j, axis) => sim.lanes.some((l) => l.axis === axis && l.controls.some((c) => c.j === j && byLane.get(l).some((o) => (l.endJ !== j || o.commit === j.id || o.d > c.dc - STOP_AT - l.len / 2) && o.d > c.dc - JUNCTION_HALF - l.len / 2 - Math.max(20, o.v * 2) && o.d < c.dc + JUNCTION_HALF + l.len / 2)));
  const plans = [];
  for (const lane of sim.lanes) {
    const list = byLane.get(lane);
    list.forEach((car, i) => {
      const L = lane.len, d = car.d;
      const base = (d >= lane.townFrom && d <= lane.townTo ? TOWN_PX_S : d < lane.nearFrom || d > lane.nearTo ? FAR_PX_S : HIGHWAY_PX_S) * car.f;
      let cap = base, hold = Infinity;
      if (d < lane.townFrom) cap = Math.min(cap, reach(TOWN_PX_S * car.f, lane.townFrom - d)); // easing off the highway into town
      if (d < lane.nearFrom) cap = Math.min(cap, reach(HIGHWAY_PX_S * car.f, lane.nearFrom - d) + 0); // and off the far road onto the highway
      const lead = list[i + 1] ?? null, leadD = lead ? lead.d : Infinity;
      if (lead) { const gap = leadD - lead.lane.len / 2 - d - L / 2 - CAR_GAP_PX; cap = Math.min(cap, reach(lead.v, gap)); hold = Math.min(hold, d + Math.max(0, gap)); }
      const ctl = lane.controls.find((c) => (c.j.kind === "roundabout" ? c.entryD > d : c.dc + JUNCTION_HALF + L / 2 > d));
      if (ctl && ctl.dc - d < LOOKAHEAD) {
        const j = ctl.j, stopD = ctl.dc - STOP_AT - L / 2, toStop = stopD - d, committed = car.commit === j.id || toStop < -0.5;
        const blockedBeyond = lead && leadD > ctl.dc && leadD - lead.lane.len / 2 < ctl.dc + JUNCTION_HALF + L + CAR_GAP_PX && lead.v < 8;
        const cross = lane.axis === "x" ? "y" : "x";
        const stop = () => { cap = Math.min(cap, toStop < 0.5 ? 0 : reach(0, toStop)); hold = Math.min(hold, stopD); };
        // Where it goes here: at the end of its road it turns (decision 267); elsewhere, now and then, it turns off
        // onto the other road (so a road that starts at a T gets its cabs). It turns once there is room on the road
        // it turns onto and, turning off a road that runs on, nothing coming the other way.
        const ends = lane.endJ === j;
        if (car.decided !== j.id) {
          car.decided = j.id; car.turnedAt = null;
          const opts = ends ? turnsAt(sim, lane, j) : j.kind !== "roundabout" && sim.rand() < TURN_ODDS ? sim.lanes.filter((l) => l.axis !== lane.axis).map((l) => ({ l, c: l.controls.find((k) => k.j === j) })).filter((o) => o.c && o.c.dc < o.l.span - 1) : [];
          const pick = opts[Math.floor(sim.rand() * opts.length)];
          car.next = pick ? { ...pick, j, at: ctl.dc } : null;
        }
        // No room on the road it turns onto: it waits at its line (or, past it, in the junction). Turning left across
        // cabs coming the other way: it pulls into the junction and waits there for a gap.
        const turning = car.next && car.next.j === j;
        const noRoom = turning && (!roomAt(sim, car.next.l, car.next.c, car) || guestAround(sim, j));
        const noGap = turning && !ends && leftTurn(lane, car.next.l) && oncoming(sim, byLane, lane, ctl, committed && j.kind === "light" && signalAt(j, sim.t)[lane.axis] === "red");
        if (noRoom && !committed) { stop(); plans.push({ car, cap, hold }); return; }
        if (noRoom || noGap) { cap = Math.min(cap, reach(0, ctl.dc - d)); hold = Math.min(hold, ctl.dc); }
        if (j.kind === "light" && !committed) {
          const sig = signalAt(j, sim.t)[lane.axis];
          if (car.rare) { if (sig === "red" ? approaching(j, cross) || guestComing(sim, j, cross) || inBox(j, cross) : inBox(j, cross)) stop(); else if (toStop < 2) car.commit = j.id; } // the owner's car runs a red when the way is clear, never into anyone
          else if (sig === "red") stop();
          else if (sig === "amber") { if (car.stopFor === j.id || car.v < 10 || toStop >= (car.v * car.v) / (2 * BRAKE_PX_S2 * 1.6)) { car.stopFor = j.id; stop(); } else car.commit = j.id; } // too close to stop: go
          else if (blockedBeyond || inBox(j, cross) || committedAcross(sim, j, cross)) { car.stopFor = null; stop(); }
          else { car.stopFor = null; if (toStop < 2) car.commit = j.id; }
        } else if (j.kind === "giveway" && !committed) {
          if (lane.axis === yieldAxis(j)) {
            // The street (or, at a T, the road that ends there) gives way: slow to a crawl at the line, go when nothing
            // on the other road is near.
            const near = (cross === "y" ? guestNear(sim, j) : guestComing(sim, j, "x")) || approaching(j, cross) || (ends && inBox(j, cross));
            if (near || blockedBeyond) stop();
            else if (toStop < 6) car.commit = j.id;
            else cap = Math.min(cap, reach(12, toStop));
          } else if (inBox(j, cross) || blockedBeyond || (ends && committedAcross(sim, j, cross))) stop();
        } else if (j.kind === "roundabout") {
          const yieldD = ctl.entryD - L / 2 - 2, toYield = yieldD - d;
          if (car.commit !== j.id) {
            cap = Math.min(cap, reach(RING_PX_S, toYield));
            if (toYield < 24) {
              const ring = byRing.get(j) ?? [];
              const busy = ring.some((o) => {
                const toEntry = ringArc(o.ring.ang, ctl.entryAng), toExit = ringArc(o.ring.ang, o.ring.exitAng);
                return (toEntry < 50 && toExit > toEntry) || TAU * RING_R - toEntry < RING_LEN + CAR_GAP_PX;
              }) || ringGuestNear(sim, j, ctl.entryAng);
              const letOn = sim.cars.some((o) => o !== car && !o.ring && o.commit === j.id && o.lane.controls.some((k) => k.j === j && ringArc(k.entryAng, ctl.entryAng) < 50));
              if (busy || letOn || (load.get(j) ?? 0) >= 3) { cap = Math.min(cap, toYield < 0.5 ? 0 : reach(0, toYield)); hold = Math.min(hold, Math.max(d, yieldD)); }
              else { car.commit = j.id; load.set(j, (load.get(j) ?? 0) + 1); }
            }
          }
          if (car.commit === j.id) { cap = Math.min(cap, RING_PX_S * 1.1); plans.push({ car, cap, hold, enter: ctl }); return; }
        }
      }
      plans.push({ car, cap, hold });
    });
  }
  for (const [j, ring] of byRing) {
    for (const car of ring) {
      let cap = RING_PX_S * car.f, ahead = Infinity;
      for (const o of [...ring, ...guestsOf(sim).filter((g) => g.ring?.j === j)]) if (o !== car) { const a = ringArc(car.ring.ang, o.ring.ang); if (a > 0 && a < ahead) ahead = a; }
      if (ahead < Infinity) cap = Math.min(cap, reach(0, ahead - RING_LEN - CAR_GAP_PX));
      const toExit = ringArc(car.ring.ang, car.ring.exitAng), out = byLane.get(car.ring.toLane) ?? [];
      if (out.some((o) => Math.abs(o.d - car.ring.toD) < car.ring.toLane.len + CAR_GAP_PX)) cap = Math.min(cap, reach(0, toExit - 1));
      plans.push({ car, cap, ringAhead: ahead, j });
    }
  }
  for (const p of plans) {
    const { car } = p;
    const v = p.cap < car.v ? Math.max(0, p.cap) : Math.min(p.cap, car.v + ACCEL_PX_S2 * dt);
    car.braking = v < car.v - 0.2 || (v < 0.5 && car.v < 0.5);
    car.v = v;
    let step = v * dt;
    if (car.ring) {
      if (p.ringAhead < Infinity) step = Math.min(step, Math.max(0, p.ringAhead - RING_LEN - CAR_GAP_PX));
      const toExit = ringArc(car.ring.ang, car.ring.exitAng);
      if (step >= toExit) { const { toLane, toD } = car.ring; car.ring = null; car.lane = toLane; car.d = toD + (step - toExit); car.commit = null; }
      else car.ring.ang -= step / RING_R;
      continue;
    }
    car.d = Math.min(car.d + step, Math.max(car.d, p.hold));
    const lane = car.lane;
    if (p.enter && car.d >= p.enter.entryD) enterRing(sim, car, p.enter);
    else if (lane.endOff && car.d > lane.span) { car.lap += 1; comeIn(sim, car, sim.entries[Math.floor(sim.rand() * sim.entries.length)]); } // off the map, and back in on a road from the edge
    else {
      // Round the corner onto the other road (the drawing eases the corner, `turn`); at the end of a road always.
      const next = car.next ?? (!lane.endOff && car.d >= lane.span - 1e-6 && lane.endJ ? { ...turnsAt(sim, lane, lane.endJ)[0], j: lane.endJ, at: lane.span } : null);
      if (next?.l && car.d >= next.at - 1e-6) {
        if (roomAt(sim, next.l, next.c, car) && !guestAround(sim, next.j)) {
          const p0 = lanePoint(lane, next.at);
          car.turn = { x: p0.x, y: p0.y, t: sim.t };
          car.lane = next.l; car.d = next.c.dc + Math.max(0, car.d - next.at); car.next = null; car.commit = next.j.id; car.decided = next.j.id; car.turnedAt = next.j.id;
          car.v = Math.min(car.v, TOWN_PX_S * car.f);
        } else car.d = next.at;
      }
    }
  }
}
export const TURN_ODDS = 0.3;
// A commuter's cab in a junction or about to come into it: a cab turning there waits for it to go through first.
// (One waiting at its line is not coming: it waits for the junction to clear.)
const guestAround = (sim, j) => guestsOf(sim).some((g) => !g.ring && Math.abs(g.x - j.cx) < JUNCTION_HALF + 60 && Math.abs(g.y - j.cy) < JUNCTION_HALF + 60 && ((g.rv ?? 1) > 1 || (Math.abs(g.x - j.cx) < JUNCTION_HALF + 12 && Math.abs(g.y - j.cy) < JUNCTION_HALF + 12)));
// A turn across the other half of the road (cabs keep right; y grows southwards on screen).
const vecOf = (l) => (l.axis === "x" ? [l.dir, 0] : [0, l.dir]);
const leftTurn = (from, to) => { const [a, b] = vecOf(from), [c, d] = vecOf(to); return a * d - b * c < 0; };
// Anyone on the other half of its own road coming up to (or in) the crossing, which a cab turning left would cut
// across; one that is turning off there itself doesn't cross its path, nor does one waiting at its line. Once its
// light is red (`boxOnly`), a cab waiting in the junction to turn left goes as soon as the junction itself is clear.
function oncoming(sim, byLane, lane, ctl, boxOnly = false) {
  const j = ctl.j;
  return sim.lanes.some((l) => l !== lane && l.axis === lane.axis && (l.axis === "x" ? l.street === lane.street : l.road === lane.road) && l.controls.some((c) => c.j === j && byLane.get(l).some((o) => o.next?.j !== j && (boxOnly ? Math.abs(o.d - c.dc) < JUNCTION_HALF + l.len / 2 + 30 : (o.v > 2 || Math.abs(o.d - c.dc) < JUNCTION_HALF + l.len / 2) && o.d > c.dc - JUNCTION_HALF - l.len / 2 - Math.max(30, o.v * 2.5) && o.d < c.dc + JUNCTION_HALF + l.len / 2))));
}
// Who gives way at a give-way crossing: the street, except at a T where the street runs on and the avenue ends there.
const yieldAxis = (j) => (j.arms && j.arms.w && j.arms.e && !(j.arms.n && j.arms.s) ? "y" : "x");
// ---------- Commuters' cabs (decision 177): a cab carrying an agent to or from work keeps to the same rules. It
// drives the route's centre line, so the simulation sees it as a guest: cruising cabs keep out of a junction it is
// crossing, give way to it on a roundabout and at a give-way line. Each frame `rideStep` says how far it may go.
export const RIDE_PX_S = 56;
const guestsOf = (sim) => sim.guests ?? [];
const RIDE_LEN = { x: 24, y: 18 };
// A cab across that has committed to the junction (it goes through whatever the light now says: the owner's car
// running a red, or one too close to stop) and is not out of it yet. A green waits for it, so the two never meet in the box.
function committedAcross(sim, j, axis) {
  return sim.cars.some((o) => o.lane && o.commit === j.id && o.lane.axis === axis && o.lane.controls.some((c) => c.j === j && o.d < c.dc + JUNCTION_HALF + o.lane.len / 2));
}
function guestInBox(sim, j, axis) {
  return guestsOf(sim).some((g) => !g.ring && (axis === "y") === g.vertical && Math.abs(g.x - j.cx) < JUNCTION_HALF + 12 && Math.abs(g.y - j.cy) < JUNCTION_HALF + 12);
}
// A commuter's cab on the given axis in the junction or close enough to it that it may be past its line on green and
// can no longer stop: the owner's car never runs a red into it (decision 264).
const guestComing = (sim, j, axis, self) => guestsOf(sim).some((g) => g !== self && !g.ring && (axis === "y") === g.vertical && Math.abs(axis === "y" ? g.x - j.cx : g.y - j.cy) < JUNCTION_HALF + 12 && Math.abs(axis === "y" ? g.y - j.cy : g.x - j.cx) < JUNCTION_HALF + 100);
const guestNear = (sim, j) => guestsOf(sim).some((g) => !g.ring && g.vertical && Math.abs(g.x - j.cx) < 12 && Math.abs(g.y - j.cy) < JUNCTION_HALF + 50);
const ringGuestNear = (sim, j, ang) => guestsOf(sim).some((g) => g.ring?.j === j && (ringArc(g.ring.ang, ang) < 50 || TAU * RING_R - ringArc(g.ring.ang, ang) < RING_LEN + CAR_GAP_PX));
const carsInBox = (sim, j, axis) => sim.cars.some((o) => o.lane && o.lane.axis === axis && o.lane.controls.some((c) => c.j === j && Math.abs(o.d - c.dc) < JUNCTION_HALF + o.lane.len / 2)) || guestInBox(sim, j, axis);

// A ride through a roundabout goes round the ring (anticlockwise, keeping right) instead of over the island: the
// route's straight run or turn at the roundabout's centre becomes an entry point, an arc and an exit point.
export function roundaboutDetours(js, route, ride, from) {
  const out = [], flags = [];
  let prev = from;
  route.forEach((p, i) => {
    const next = route[i + 1], j = ride[i] && js.find((k) => k.kind === "roundabout" && Math.abs(k.cx - p.x) < 1 && Math.abs(k.cy - p.y) < 1);
    const through = ride[i] && !j && js.find((k) => k.kind === "roundabout" && onSegment(prev, p, k));
    const at = j || through;
    if (at && (j ? next && ride[i + 1] : true)) {
      const inDir = unit(prev, at.cx === p.x && at.cy === p.y ? p : { x: at.cx, y: at.cy }), outDir = j ? unit(p, next) : inDir;
      const a0 = Math.atan2(-inDir.y, -inDir.x), a1 = Math.atan2(outDir.y, outDir.x);
      let sweep = ((a0 - a1) % TAU + TAU) % TAU;
      if (sweep < 0.01) sweep = TAU;
      const n = Math.max(2, Math.ceil(sweep / 0.35));
      for (let k = 0; k <= n; k++) { const a = a0 - (sweep * k) / n; out.push({ x: at.cx + RING_R * Math.cos(a), y: at.cy + RING_R * Math.sin(a), ring: at.id }); flags.push(true); }
      if (!j) { out.push(p); flags.push(ride[i]); }
    } else { out.push(p); flags.push(ride[i]); }
    prev = p;
  });
  return { route: out, ride: flags };
}
const unit = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
function onSegment(a, b, j) {
  const c = { x: j.cx, y: j.cy };
  if (Math.abs(a.x - b.x) < 1 && Math.abs(a.x - c.x) < 1) return (c.y - a.y) * (c.y - b.y) < 0 && Math.abs(c.y - b.y) > RING_R;
  if (Math.abs(a.y - b.y) < 1 && Math.abs(a.y - c.y) < 1) return (c.x - a.x) * (c.x - b.x) < 0 && Math.abs(c.x - b.x) > RING_R;
  return false;
}

// The roundabout a rider is driving round right now, if any.
export function ringOf(sim, r) {
  const j = r.to?.ring && sim.junctions.find((k) => k.id === r.to.ring);
  return j && Math.abs(Math.hypot(r.x - j.cx, r.y - j.cy) - RING_R) < 1.5 ? j : null;
}
// How far a commuter's cab moves this frame (`r` is the rider: x, y, its next route point `to`, and its own speed
// `rv`, stop memory and roundabout commitment, kept on it between frames).
// `r.boost` (default 1) multiplies its pace and pick-up: a cab taking a new hire to work drives TO_WORK_BOOST times as
// fast (decision 211), still stopping for lights and the car ahead.
export const TO_WORK_BOOST = 2.5;
export function rideStep(sim, r, dt) {
  const hold = rideHold(sim, r), onRing = ringOf(sim, r) !== null, k = r.boost ?? 1;
  const cap = Math.min((onRing ? RING_PX_S : RIDE_PX_S) * k, hold === Infinity ? Infinity : hold < 0.5 ? 0 : reach(0, hold) * k);
  r.rv = cap < (r.rv ?? 0) ? cap : Math.min(cap, (r.rv ?? 0) + ACCEL_PX_S2 * 1.4 * k * dt);
  r.braking = cap < RIDE_PX_S * k * 0.5;
  return Math.max(0, Math.min(r.rv * dt, hold));
}
export function rideHold(sim, r) {
  const to = r.to;
  if (!to) return Infinity;
  const rj = ringOf(sim, r);
  if (rj) {
    // On the ring: keep behind whoever is ahead on it.
    const j = rj, ang = Math.atan2(r.y - j.cy, r.x - j.cx);
    let ahead = Infinity;
    for (const o of [...sim.cars.filter((c) => c.ring?.j === j), ...guestsOf(sim).filter((g) => g.ring?.j === j && g !== r.guest)]) { const a = ringArc(ang, o.ring.ang); if (a > 0.5 && a < ahead) ahead = a; }
    return ahead === Infinity ? Infinity : Math.max(0, ahead - RING_LEN - CAR_GAP_PX);
  }
  const dx = to.x - r.x, dy = to.y - r.y;
  const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y", sign = Math.sign(axis === "x" ? dx : dy) || 1, L = RIDE_LEN[axis], cross = axis === "x" ? "y" : "x";
  if ((axis === "x" ? Math.abs(dy) : Math.abs(dx)) > 1) return Infinity;
  const len = Math.abs(axis === "x" ? dx : dy);
  let best = null;
  for (const j of sim.junctions) {
    if (Math.abs(axis === "x" ? j.cy - r.y : j.cx - r.x) > 1) continue;
    const along = sign * (axis === "x" ? j.cx - r.x : j.cy - r.y);
    if (along <= 0 || along > len + RING_R + 1) continue;
    if (!best || along < best.along) best = { j, along };
  }
  if (!best) return Infinity;
  const { j, along } = best;
  if (j.kind === "roundabout") {
    const yieldAt = along - RING_R - L / 2 - 2;
    if (r.commit === j.id || yieldAt < -0.5 || yieldAt > 24) return Infinity;
    const entryAng = Math.atan2(r.y - j.cy, r.x - j.cx);
    const load = sim.cars.filter((c) => c.ring?.j === j || c.commit === j.id).length + guestsOf(sim).filter((g) => g !== r.guest && (g.ring?.j === j || g.commit === j.id)).length;
    const busy = sim.cars.some((o) => { if (o.ring?.j !== j) return false; const toEntry = ringArc(o.ring.ang, entryAng), toExit = ringArc(o.ring.ang, o.ring.exitAng); return (toEntry < 50 && toExit > toEntry) || TAU * RING_R - toEntry < RING_LEN + CAR_GAP_PX; }) || guestsOf(sim).some((g) => g !== r.guest && g.ring?.j === j && (ringArc(g.ring.ang, entryAng) < 50 || TAU * RING_R - ringArc(g.ring.ang, entryAng) < RING_LEN + CAR_GAP_PX));
    if (busy || load >= 3) return Math.max(0, yieldAt);
    r.commit = j.id;
    return Infinity;
  }
  const stopAt = along - STOP_AT - L / 2;
  if (stopAt < -0.5) return Infinity; // over the line already: through the junction
  if (j.kind === "light") {
    const sig = signalAt(j, sim.t)[axis], v = r.rv ?? 0;
    if (r.rare) { // the owner's car runs a red when the way is clear, never into anyone
      const coming = sig === "red" && sim.cars.some((o) => o.lane && o.lane.axis === cross && o.lane.controls.some((c) => c.j === j && o.d > c.dc - JUNCTION_HALF - o.lane.len / 2 - Math.max(20, o.v * 2) && o.d < c.dc + JUNCTION_HALF + o.lane.len / 2));
      return coming || guestComing(sim, j, cross, r.guest) || carsInBox(sim, j, cross) ? Math.max(0, stopAt) : Infinity;
    }
    if (sig === "red") return Math.max(0, stopAt);
    if (sig === "amber") { if (r.stopFor === j.id || v < 10 || stopAt >= (v * v) / (2 * BRAKE_PX_S2 * 1.6)) { r.stopFor = j.id; return Math.max(0, stopAt); } return Infinity; }
    r.stopFor = null;
    return carsInBox(sim, j, cross) || committedAcross(sim, j, cross) ? Math.max(0, stopAt) : Infinity;
  }
  if (axis === yieldAxis(j)) {
    const near = sim.cars.some((o) => o.lane && o.lane.axis === cross && (o.lane.endJ !== j || o.commit === j.id) && o.lane.controls.some((c) => c.j === j && o.d > c.dc - JUNCTION_HALF - o.lane.len / 2 - Math.max(20, o.v * 2) && o.d < c.dc + JUNCTION_HALF + o.lane.len / 2)) || (cross === "y" && guestNear(sim, j));
    return near ? Math.max(0, stopAt) : Infinity;
  }
  return carsInBox(sim, j, cross) ? Math.max(0, stopAt) : Infinity;
}

// Onto the roundabout: straight on half the time, otherwise left or right; never back the way it came.
function enterRing(sim, car, ctl) {
  const j = ctl.j, from = car.lane, options = [];
  for (const l of sim.lanes) {
    if (l !== from && (l.axis === from.axis && (l.axis === "x" ? l.street === from.street : l.road === from.road))) continue; // a U-turn
    const c = l.controls.find((k) => k.j === j);
    if (c && c.exitD > 0 && c.exitD < l.span) options.push({ l, c, w: l === from ? 2 : 1 });
  }
  const total = options.reduce((s, o) => s + o.w, 0);
  let r = sim.rand() * total, pick = options[0];
  for (const o of options) { r -= o.w; if (r < 0) { pick = o; break; } }
  car.ring = { j, ang: ctl.entryAng, exitAng: pick.c.exitAng, toLane: pick.l, toD: pick.c.exitD };
  car.lane = null;
}
// Where every cab is, for drawing: side on along a street, nose or tail on along a through road; on a roundabout,
// whichever way it is heading.
export function trafficCars(sim) {
  return sim.cars.map((c) => {
    if (c.ring) {
      const { j, ang } = c.ring, tx = Math.sin(ang), ty = -Math.cos(ang), vertical = Math.abs(ty) > Math.abs(tx);
      return { id: c.id, x: j.cx + RING_R * Math.cos(ang), y: j.cy + RING_R * Math.sin(ang), vertical, east: vertical ? ty < 0 : tx > 0, alpha: 1, rare: c.rare, braking: c.braking, v: c.v, ring: j.id };
    }
    const l = c.lane, p = lanePoint(l, c.d);
    const k = c.turn ? (sim.t - c.turn.t) / TURN_MS : 1; // just round a corner: eased from the end of the old lane
    if (k < 1) { const e = k * k * (3 - 2 * k); p.x = c.turn.x + (p.x - c.turn.x) * e; p.y = c.turn.y + (p.y - c.turn.y) * e; }
    // Faded only on a stretch of road at the map's faded border: never in town.
    const alpha = Math.min(l.startOff ? edgeAlpha(c.d, 0, Infinity) : 1, l.endOff ? edgeAlpha(c.d, -Infinity, l.span) : 1);
    return { id: c.id, x: p.x, y: p.y, vertical: l.axis === "y", east: l.axis === "x" ? l.dir > 0 : l.dir < 0, alpha, rare: c.rare, braking: c.braking, v: c.v, lane: l.id, turning: k < 1, turnedAt: c.turnedAt ?? null };
  });
}
const TURN_MS = 350;
// A commute by cab: which legs of a route are ridden. A leg is ridden when it runs along a street or the avenue,
// from the first kerb a cab can reach to the kerb in front of the tower; the path from the apartment doors (grass, no
// cabs) and the steps through the doors stay a walk.
export function rideLegs(world, route, from) {
  const lanes = new Set(world.streets.map((s) => (s.y + STREET / 2) * TILE));
  const ax = (world.avenue + STREET / 2) * TILE;
  const onRoad = (p) => lanes.has(p.y) || p.x === ax;
  let prev = from;
  return route.map((p) => { const ride = onRoad(prev) && onRoad(p) && (p.x !== prev.x || p.y !== prev.y); prev = p; return ride; });
}

// A taxi called for a new hire (decision 207): before the worker leaves home, a cab drives along the street to the
// kerb where the ride starts (the first ridden leg's start) and waits there. It comes from up to CALL_PX behind,
// heading the way the ride will set off, kept on that street's own stretch of road. Null when nothing is ridden.
export const CALL_PX = 150;
export function taxiCall(world, route, ride, from) {
  const i = ride.indexOf(true);
  if (i < 0) return null;
  const at = i === 0 ? from : route[i - 1], next = route[i], d = unit(at, next);
  let x = at.x - d.x * CALL_PX, y = at.y - d.y * CALL_PX;
  if (Math.abs(d.x) >= Math.abs(d.y)) {
    const s = world.streets.find((t) => (t.y + STREET / 2) * TILE === at.y);
    const L = world.left ?? 0, lo = s && s.x0 > L ? s.x0 * TILE + 12 : (L - MAP_MARGIN) * TILE, hi = s && s.x1 < world.width ? s.x1 * TILE - 12 : (world.width + MAP_MARGIN) * TILE; // the street to the suburb runs on out of town
    x = Math.max(lo, Math.min(hi, x));
  } else y = Math.max((world.top ?? 0) * TILE, Math.min(world.height * TILE, y));
  return { at: { x: at.x, y: at.y }, start: { x, y }, leg: i };
}

// ---------- Connector signs (decision 173) ----------
// The connected tools a department uses, in a steady order (those with a logo first, then by name), for the signs
// by its tower's doors. Decision 271 (the owner: "each building that has an MCP… if we have Jira for all
// departments, Jira's logo should be on the building"): a tool hangs on a tower when that department's team can use it
// (its `roles` give managers or workers access) and it is for that department: one for every department (Jira) on
// every tower, one picked for some departments on theirs, and one whose departments were never worked out on every
// tower whose team can use it. HQ ("HQ") shows the tools VAIC or the Orchestrator can use. A tool switched off or
// removed is no longer "ready" and comes down.
export function signsFor(state, dept) {
  const k = keyOf(dept), hq = dept === "HQ";
  const can = (c) => (!c.roles ? true : hq ? !!(c.roles.vaic || c.roles.orchestrator) : !!(c.roles.manager || c.roles.worker));
  const forDept = (c) => hq || c.every_department || !Array.isArray(c.departments) || c.departments.some((d) => keyOf(d) === k);
  return Object.values(state.connectors ?? {})
    .filter((c) => c.status === "ready" && can(c) && forDept(c))
    .sort((a, b) => Number(!a.sign) - Number(!b.sign) || String(a.label ?? a.id).localeCompare(String(b.label ?? b.id)) || String(a.id).localeCompare(String(b.id)));
}
export const PLAQUE = 14; // a 12-pixel logo in a 1-pixel ink frame
// Where the plaques hang on a tower's lobby front: one row at door height, filling outwards from the door on both
// sides, left first, so a tower with many tools still looks tidy. When there are more tools than places, the last
// place says "+N". Returns [{ x, y, sign | null, more }] in art pixels.
export function plaqueSlots(signs, { baseX, baseW, cx, foot }) {
  const gap = 2, doorHalf = 15, y = foot - 21, step = PLAQUE + gap;
  const perSide = Math.max(0, Math.floor((cx - doorHalf - gap - (baseX + 3)) / step));
  const places = [];
  for (let i = 0; i < perSide; i++) {
    places.push(Math.round(cx - doorHalf - gap - PLAQUE - i * step)); // left of the door, going outwards
    places.push(Math.round(cx + doorHalf + gap + i * step)); // right of the door
  }
  const n = signs.length;
  if (!n || !places.length) return [];
  const shown = n > places.length ? places.length - 1 : n;
  const out = signs.slice(0, shown).map((sign, i) => ({ x: places[i], y, sign, more: 0 }));
  if (n > shown) out.push({ x: places[shown], y, sign: null, more: n - shown });
  return out;
}
