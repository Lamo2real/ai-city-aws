// The custom tools each role gets, exposed in-process to the Agent SDK. Each handler is plain code
// over the ledger, the bus and the queue; the policy gate wraps every call (see gateTools).
import {
  answerQuestion,
  instructAgent,
  move,
  newTicket,
  quote,
  send,
  statusSummary,
  type CityDeps,
  departmentKey,
  gate,
  managerId,
  type AgentRecord,
  type HireSpec,
  type Role,
  type TicketStatus,
  workerSpec,
} from "@aic/shared";
import { z } from "zod";

export type { CityDeps };
export { move };

export interface TurnCtx {
  agentId: string;
  role: Exclude<Role, "utility">;
  department: string | null;
  ticketId: string;
  taskId: string;
  conversation?: string;
}
export interface ToolSpec {
  name: string;
  description: string;
  input: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export const CITY_SERVER = "city";
export const mcpName = (tool: string) => `mcp__${CITY_SERVER}__${tool}`;

const DONE_OR_GONE: TicketStatus[] = ["done", "failed", "cancelled"];

// ---------- Ace ----------
function aceTools(d: CityDeps, c: TurnCtx): ToolSpec[] {
  return [
    {
      name: "delegate_to_orchestrator",
      description: "Hand real work to the Orchestrator. Use for anything beyond a quick answer.",
      input: { goal: z.string().min(3), owner_words: z.string(), constraints: z.string().optional() },
      handler: async (a) => {
        const t = await newTicket(d, {
          goal: String(a.goal),
          from: "ace",
          to: "orchestrator",
          department: null,
          parent_id: null,
          kind: "task",
          acceptance: a.constraints ? String(a.constraints) : undefined,
          conversation: c.conversation,
        });
        await send(d, {
          role: "orchestrator",
          agentId: "orchestrator",
          department: null,
          ticketId: t.id,
          taskId: t.id,
          kind: "task",
          from: "ace",
          body: `New task from the owner.\nGoal: ${String(a.goal)}\nOwner's words: ${String(a.owner_words)}${a.constraints ? `\nConstraints: ${String(a.constraints)}` : ""}`,
          conversation: c.conversation,
        });
        return `Handed to the Orchestrator as task ${t.id}.`;
      },
    },
    {
      name: "get_status",
      description: "Tickets, departments, live agents and spend, in one summary.",
      input: {},
      handler: async () => JSON.stringify(await statusSummary(d)),
    },
    {
      name: "answer_question",
      description: "Send the owner's answer to a waiting question.",
      input: { question_id: z.string(), answer: z.string().min(1) },
      handler: async (a) => {
        const r = await answerQuestion(d, String(a.question_id), String(a.answer), "owner");
        return r ?? "That question was already answered or does not exist.";
      },
    },
    {
      name: "instruct_agent",
      description: "Send the owner's instruction to one agent (the @agent feature). Its manager is copied.",
      input: { agent_id: z.string(), text: z.string().min(1) },
      handler: async (a) => instructAgent(d, String(a.agent_id), String(a.text)),
    },
    {
      name: "add_note",
      description: "Save a note for the owner.",
      input: { text: z.string().min(1) },
      handler: async (a) => `Saved note ${(await d.ledger.addNote(String(a.text), "note")).id}.`,
    },
    {
      name: "list_notes",
      description: "List the owner's notes and pending reminders.",
      input: {},
      handler: async () =>
        JSON.stringify({ notes: await d.ledger.listNotes("note"), reminders: await d.ledger.listNotes("reminder") }),
    },
    {
      name: "add_reminder",
      description: "Add a reminder with a due time (ISO 8601).",
      input: { text: z.string().min(1), due_at: z.string() },
      handler: async (a) => {
        if (Number.isNaN(Date.parse(String(a.due_at)))) return "That due time is not a valid date.";
        return `Reminder ${(await d.ledger.addNote(String(a.text), "reminder", String(a.due_at))).id} saved.`;
      },
    },
    {
      name: "pause_city",
      description: "Pause the city: no new turns start; running turns finish.",
      input: { reason: z.string().optional() },
      handler: async (a) => {
        await d.ledger.updateSettings({
          paused: true,
          pause_reason: a.reason ? String(a.reason) : "Paused by the owner",
        });
        await d.bus.put({
          type: "city.state",
          paused: true,
          reason: a.reason ? String(a.reason) : "Paused by the owner",
        });
        return "The city is paused. Work already running will finish; nothing new starts.";
      },
    },
    {
      name: "resume_city",
      description: "Resume the city.",
      input: {},
      handler: async () => {
        await d.ledger.updateSettings({ paused: false, pause_reason: null });
        await d.bus.put({ type: "city.state", paused: false, reason: null });
        return "The city is running again.";
      },
    },
  ];
}

// ---------- Orchestrator ----------
function orchestratorTools(d: CityDeps, c: TurnCtx): ToolSpec[] {
  return [
    {
      name: "create_department",
      description: "Create a department (data). Its manager is created dormant and costs nothing until work arrives.",
      input: { name: z.string().min(2).max(40), mission: z.string().min(10) },
      handler: async (a) => {
        const name = String(a.name).trim();
        const { department, created } = await d.ledger.createDepartment(name, String(a.mission), managerId(name));
        if (!created) return `${department.name} already exists; use it.`;
        const mgr: AgentRecord = {
          id: department.manager_id,
          kind: "manager",
          role: `${department.name} Manager`,
          department: department.name,
          model: "fable-5-1",
          parent: "orchestrator",
          state: "dormant",
          worker_state: null,
          total_cost_usd: 0,
          hired_at: d.ledger.now().toISOString(),
        };
        await d.ledger.putAgent(mgr);
        await d.bus.put({
          type: "department.created",
          name: department.name,
          mission: department.mission,
          manager_id: mgr.id,
        });
        await d.bus.put({ type: "agent.hired", agent: mgr });
        return `Created ${department.name}, managed by ${mgr.id}.`;
      },
    },
    {
      name: "assign_to_department",
      description: "Send one goal to a department's manager.",
      input: { department: z.string(), goal: z.string().min(3), acceptance: z.string().min(3) },
      handler: async (a) => {
        const dept = await d.ledger.getDepartment(String(a.department));
        if (!dept) return `There is no department called ${String(a.department)}. Create it first.`;
        const t = await newTicket(d, {
          goal: String(a.goal),
          acceptance: String(a.acceptance),
          from: "orchestrator",
          to: dept.manager_id,
          department: dept.name,
          parent_id: c.taskId,
          kind: "assignment",
        });
        const task = await d.ledger.getTicket(c.taskId);
        if (task?.status === "open") await move(d, c.taskId, "in_progress", "sent to departments");
        await send(d, {
          role: "manager",
          agentId: dept.manager_id,
          department: dept.name,
          ticketId: t.id,
          taskId: c.taskId,
          kind: "task",
          from: "orchestrator",
          body: `Goal for ${dept.name}: ${String(a.goal)}\nAcceptance: ${String(a.acceptance)}`,
        });
        return `Sent to ${dept.name} as ${t.id}.`;
      },
    },
    {
      name: "get_reports",
      description: "The departments' tickets for this task, with their status and reports.",
      input: {},
      handler: async () => {
        const kids = await d.ledger.childTickets(c.taskId);
        return JSON.stringify(
          kids
            .filter((k) => k.kind === "assignment")
            .map((k) => ({
              ticket: k.id,
              department: k.department,
              status: k.status,
              report: k.result ? quote(k.to, k.result) : null,
            })),
        );
      },
    },
    {
      name: "sign_off",
      description: "Final sign-off on the task: PASS, or FAIL with reasons (the work goes back to the department).",
      input: { verdict: z.enum(["PASS", "FAIL"]), reasons: z.string().min(3), department: z.string().optional() },
      handler: async (a) => {
        const verdict = a.verdict as "PASS" | "FAIL";
        const kids = (await d.ledger.childTickets(c.taskId)).filter((k) => k.kind === "assignment");
        if (verdict === "PASS") {
          const open = kids.filter((k) => k.status !== "in_review" && !DONE_OR_GONE.includes(k.status));
          if (open.length) return `Not yet: ${open.map((k) => k.department).join(", ")} has not reported.`;
          for (const k of kids.filter((k) => k.status === "in_review")) await move(d, k.id, "done", "signed off");
          await d.ledger.table.put({
            pk: `TICKET#${c.taskId}`,
            sk: "SIGNOFF",
            verdict,
            at: d.ledger.now().toISOString(),
          });
        } else {
          const target =
            kids.find(
              (k) => a.department && departmentKey(String(k.department)) === departmentKey(String(a.department)),
            ) ?? kids.find((k) => k.status === "in_review");
          if (!target) return "Name the department that must fix it.";
          await move(d, target.id, "in_progress", "sign-off failed", { review_rounds: target.review_rounds + 1 });
          await send(d, {
            role: "manager",
            agentId: target.to,
            department: target.department,
            ticketId: target.id,
            taskId: c.taskId,
            kind: "fix",
            from: "orchestrator",
            body: `The Orchestrator did not sign off. Fix and report again: ${String(a.reasons)}`,
          });
        }
        await d.bus.put({
          type: "signoff.result",
          ticket_id: c.taskId,
          verdict,
          summary: String(a.reasons).slice(0, 300),
        });
        return verdict === "PASS" ? "Signed off. Now report to Ace." : "Sent back for fixes.";
      },
    },
    askOwner(d, c),
    {
      name: "report_to_ace",
      description: "Report the finished task to Ace. Only after a PASS sign-off.",
      input: { summary: z.string().min(3) },
      handler: async (a) => {
        const signed = await d.ledger.table.get(`TICKET#${c.taskId}`, "SIGNOFF");
        if (signed?.verdict !== "PASS") return "Sign off with PASS before reporting.";
        const task = await move(d, c.taskId, "done", "reported to Ace", { result: String(a.summary) });
        await d.bus.put({ type: "result", ticket_id: c.taskId, summary: String(a.summary).slice(0, 500) });
        await send(d, {
          role: "ace",
          agentId: "ace",
          department: null,
          ticketId: c.taskId,
          taskId: c.taskId,
          kind: "report",
          from: "orchestrator",
          body: quote("the Orchestrator", String(a.summary)),
          conversation: task.conversation,
        });
        return "Reported to Ace.";
      },
    },
  ];
}

function askOwner(d: CityDeps, c: TurnCtx): ToolSpec {
  return {
    name: "ask_owner",
    description: "Ask the owner a question through Ace. Always give options and a default.",
    input: { question: z.string().min(3), options: z.array(z.string()).min(1), default_answer: z.string().min(1) },
    handler: async (a) => {
      const agent = await d.ledger.getAgent(c.agentId);
      const path = agent?.parent && agent.parent !== "orchestrator" ? `${agent.parent} › ${c.agentId}` : c.agentId;
      const q = await d.ledger.askQuestion({
        asked_by: c.agentId,
        path,
        ticket_id: c.ticketId,
        text: String(a.question),
        options: (a.options as string[]).map(String),
        default_answer: String(a.default_answer),
      });
      await move(d, c.ticketId, "waiting_on_owner", "question for the owner");
      await d.bus.put({ type: "question.asked", question: q });
      return `Asked the owner (question ${q.id}). End your turn; the answer arrives as a new message.`;
    },
  };
}

// ---------- Manager ----------
function managerTools(d: CityDeps, c: TurnCtx): ToolSpec[] {
  const dept = c.department!;
  const mine = async (workerId: string) => {
    const w = await d.ledger.getAgent(workerId);
    return w && w.kind === "worker" && w.parent === c.agentId ? w : null;
  };
  return [
    {
      name: "hire_worker",
      description: "Hire a worker consultant for one assignment.",
      input: {
        specialty: z.string(),
        instructions: z.string(),
        tools: z.array(z.string()),
        budget_hint_usd: z.number().optional(),
        specialist_id: z.string().optional(),
      },
      handler: async (a) => {
        try {
          const w = await d.factory.hire(a as unknown as HireSpec, c.agentId, dept);
          return `Hired ${w.id} (${w.role}).`;
        } catch (e) {
          return `Hire refused: ${(e as Error).message}`;
        }
      },
    },
    {
      name: "assign",
      description: "Give one of your workers its assignment.",
      input: { worker_id: z.string(), goal: z.string().min(3), acceptance: z.string().min(3) },
      handler: async (a) => {
        const w = await mine(String(a.worker_id));
        if (!w || w.state === "retired") return `${String(a.worker_id)} is not one of your workers.`;
        const t = await newTicket(d, {
          goal: String(a.goal),
          acceptance: String(a.acceptance),
          from: c.agentId,
          to: w.id,
          department: dept,
          parent_id: c.ticketId,
          kind: "assignment",
        });
        await d.ledger.updateAgent(w.id, { ticket_id: t.id, worker_state: "working" });
        await d.bus.put({ type: "worker.state", id: w.id, state: "working" });
        await send(d, {
          role: "worker",
          agentId: w.id,
          department: dept,
          ticketId: t.id,
          taskId: c.taskId,
          kind: "task",
          from: c.agentId,
          body: `Assignment: ${String(a.goal)}\nAcceptance: ${String(a.acceptance)}`,
        });
        return `Assigned ${t.id} to ${w.id}.`;
      },
    },
    {
      name: "answer_worker",
      description: "Answer a worker's question.",
      input: { worker_id: z.string(), answer: z.string().min(1) },
      handler: async (a) => {
        const w = await mine(String(a.worker_id));
        if (!w?.ticket_id) return `${String(a.worker_id)} is not one of your working workers.`;
        await d.ledger.updateAgent(w.id, { worker_state: "working" });
        await d.bus.put({ type: "worker.state", id: w.id, state: "working" });
        await send(d, {
          role: "worker",
          agentId: w.id,
          department: dept,
          ticketId: w.ticket_id,
          taskId: c.taskId,
          kind: "answer",
          from: c.agentId,
          body: `Your manager answered: ${String(a.answer)}`,
        });
        return "Answer sent.";
      },
    },
    {
      name: "review",
      description:
        "Review a worker's reported deliverable: PASS, or FAIL with exact reasons (it goes back to the worker).",
      input: { ticket_id: z.string(), verdict: z.enum(["PASS", "FAIL"]), reasons: z.string().min(3) },
      handler: async (a) => {
        const t = await d.ledger.getTicket(String(a.ticket_id));
        if (!t || t.from !== c.agentId) return "That is not one of your assignments.";
        if (t.status !== "in_review") return "That assignment has not been reported yet.";
        const verdict = a.verdict as "PASS" | "FAIL";
        const round = t.review_rounds + 1;
        await d.bus.put({
          type: "review.result",
          ticket_id: t.id,
          agent: t.to,
          reviewer: c.agentId,
          verdict,
          summary: String(a.reasons).slice(0, 300),
          round,
        });
        if (verdict === "PASS") {
          await move(d, t.id, "done", "review passed", { review_rounds: round });
          await d.ledger.updateAgent(t.to, { worker_state: "completed" });
          await d.bus.put({ type: "worker.state", id: t.to, state: "completed" });
          return `PASS recorded. Release ${t.to} when you no longer need it.`;
        }
        if (round >= d.maxReviewRounds) {
          await move(d, t.id, "waiting_on_owner", "too many review rounds", { review_rounds: round });
          const q = await d.ledger.askQuestion({
            asked_by: c.agentId,
            path: c.agentId,
            ticket_id: t.id,
            text: `${t.to}'s work failed review ${round} times. Latest reasons: ${String(a.reasons)}. What should happen?`,
            options: ["Try once more", "Stop this assignment"],
            default_answer: "Stop this assignment",
          });
          await d.bus.put({ type: "question.asked", question: q });
          return "Review limit reached; asked the owner.";
        }
        await move(d, t.id, "in_progress", "review failed", { review_rounds: round });
        await d.ledger.updateAgent(t.to, { worker_state: "working" });
        await d.bus.put({ type: "worker.state", id: t.to, state: "working", detail: "fixing after review" });
        await send(d, {
          role: "worker",
          agentId: t.to,
          department: dept,
          ticketId: t.id,
          taskId: c.taskId,
          kind: "fix",
          from: c.agentId,
          body: `Your manager's review: FAIL. Fix exactly this and report again: ${String(a.reasons)}`,
        });
        return "FAIL recorded; sent back to the worker.";
      },
    },
    {
      name: "release_worker",
      description: "Release a worker whose work passed review.",
      input: { worker_id: z.string() },
      handler: async (a) => {
        try {
          const w = await d.factory.release(String(a.worker_id), c.agentId);
          return `Released ${w.id}.`;
        } catch (e) {
          return `Not released: ${(e as Error).message}`;
        }
      },
    },
    {
      name: "save_specialist",
      description: "Save a worker's spec so it can be hired again later.",
      input: { worker_id: z.string() },
      handler: async (a) => {
        const w = await mine(String(a.worker_id));
        const spec = w && (await workerSpec(d.ledger, w.id));
        if (!w || !spec) return `${String(a.worker_id)} is not one of your workers.`;
        const s = await d.ledger.saveSpecialist({
          department: dept,
          specialty: w.specialty ?? w.role,
          instructions: spec.instructions,
          tools: spec.tools,
        });
        return `Saved as specialist ${s.id}.`;
      },
    },
    askOwner(d, c),
    {
      name: "report_to_orchestrator",
      description: "Report the department's finished goal to the Orchestrator.",
      input: { summary: z.string().min(3) },
      handler: async (a) => {
        const kids = (await d.ledger.childTickets(c.ticketId)).filter((k) => k.kind === "assignment");
        const unreviewed = kids.filter((k) => !DONE_OR_GONE.includes(k.status));
        if (unreviewed.length) return `Not yet: ${unreviewed.map((k) => k.id).join(", ")} has not passed review.`;
        await move(d, c.ticketId, "in_review", "reported to the Orchestrator", { result: String(a.summary) });
        await send(d, {
          role: "orchestrator",
          agentId: "orchestrator",
          department: null,
          ticketId: c.taskId,
          taskId: c.taskId,
          kind: "report",
          from: c.agentId,
          body: quote(c.agentId, String(a.summary)),
        });
        return "Reported to the Orchestrator.";
      },
    },
  ];
}

// ---------- Worker ----------
function workerTools(d: CityDeps, c: TurnCtx): ToolSpec[] {
  const manager = async () => (await d.ledger.getAgent(c.agentId))?.parent ?? managerId(c.department ?? "");
  return [
    {
      name: "ask_manager",
      description: "Ask your manager a question. Keep working on a sensible default meanwhile.",
      input: { question: z.string().min(3) },
      handler: async (a) => {
        const m = await manager();
        await d.ledger.updateAgent(c.agentId, { worker_state: "waiting" });
        await d.bus.put({ type: "worker.state", id: c.agentId, state: "waiting", detail: "waiting for an answer" });
        const mgrTicket = (await d.ledger.getTicket(c.ticketId))?.parent_id ?? c.ticketId;
        await send(d, {
          role: "manager",
          agentId: m,
          department: c.department,
          ticketId: mgrTicket,
          taskId: c.taskId,
          kind: "question",
          from: c.agentId,
          body: `${c.agentId} asks: ${String(a.question)}`,
        });
        return "Question sent to your manager.";
      },
    },
    {
      name: "report_to_manager",
      description: "Report your finished assignment: status, summary, artifacts, checks and results.",
      input: { summary: z.string().min(3), artifacts: z.array(z.string()).default([]), checks: z.string().default("") },
      handler: async (a) => {
        const m = await manager();
        const body = `${String(a.summary)}\nArtifacts: ${(a.artifacts as string[]).join(", ") || "none"}\nChecks: ${String(a.checks) || "none"}`;
        await move(d, c.ticketId, "in_review", "reported", { result: body });
        await d.ledger.updateAgent(c.agentId, { worker_state: "review" });
        await d.bus.put({ type: "worker.state", id: c.agentId, state: "reporting" });
        const mgrTicket = (await d.ledger.getTicket(c.ticketId))?.parent_id ?? c.ticketId;
        await send(d, {
          role: "manager",
          agentId: m,
          department: c.department,
          ticketId: mgrTicket,
          taskId: c.taskId,
          kind: "report",
          from: c.agentId,
          body: `${c.agentId} reported assignment ${c.ticketId}.\n${quote(c.agentId, body)}`,
        });
        return "Reported to your manager. End your turn.";
      },
    },
  ];
}

export function toolsFor(d: CityDeps, c: TurnCtx): ToolSpec[] {
  switch (c.role) {
    case "ace":
      return aceTools(d, c);
    case "orchestrator":
      return orchestratorTools(d, c);
    case "manager":
      return managerTools(d, c);
    case "worker":
      return workerTools(d, c);
  }
}

/** Files an owner approval bound to this exact action (once per action while it is pending). */
export async function fileApproval(
  d: CityDeps,
  c: TurnCtx,
  tool: string,
  input: Record<string, unknown>,
  needs: { hash: string; reason: string },
): Promise<void> {
  if ((await d.ledger.pendingApprovals()).some((a) => a.hash === needs.hash)) return;
  const action =
    typeof input.command === "string" ? input.command.slice(0, 200) : `${tool} ${Object.keys(input).join(", ")}`;
  const a = await d.ledger.requestApproval({
    agent: c.agentId,
    ticket_id: c.ticketId,
    tool,
    action,
    hash: needs.hash,
    reason: needs.reason,
  });
  await d.bus.put({ type: "approval.requested", id: a.id, agent: c.agentId, action, reason: needs.reason });
}

/** Every custom tool call passes the policy gate and is written to the ledger. */
export function gateTools(d: CityDeps, c: TurnCtx, specs: ToolSpec[]): ToolSpec[] {
  return specs.map((s) => ({
    ...s,
    handler: async (args) => {
      const name = mcpName(s.name);
      const r = await gate(name, args, {
        role: c.role,
        agentId: c.agentId,
        consumeApproval: (h) => d.ledger.consumeApproval(h),
      });
      await d.ledger.auditTool(c.agentId, name, r.decision, r.reason);
      if (r.needsApproval) await fileApproval(d, c, name, args, r.needsApproval);
      if (r.decision === "deny") return `Denied by policy: ${r.reason}`;
      return s.handler(args);
    },
  }));
}
