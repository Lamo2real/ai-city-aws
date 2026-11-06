// One agent turn inside the AgentCore runtime: read the ledger, build the prompt, run the gated turn
// with the role's tools, and tidy up. The same code runs for all four roles; the role comes from the
// invocation (each runtime is configured with one role and refuses others).
import {
  log,
  managerId,
  resolveRoleFromEnv,
  runGatedTurn,
  type AgentRecord,
  type BackoffOptions,
  type Invocation,
  type Role,
} from "@aic/shared";
import type { AgentEngine } from "./engine.ts";
import { departmentTemplate, loadPrompt } from "./prompts.ts";
import { fileApproval, gateTools, move, toolsFor, type CityDeps, type TurnCtx } from "./tools.ts";

const WORKER_BUILTINS: Record<string, string[]> = {
  Bash: ["Bash"],
  Read: ["Read", "Glob", "Grep"],
  Glob: ["Glob"],
  Grep: ["Grep"],
  Write: ["Write"],
  Edit: ["Edit"],
  WebSearch: ["WebSearch"],
  WebFetch: ["WebFetch"],
  git: ["Bash"],
  code_interpreter: ["mcp__agentcore__code_interpreter"],
  browser: ["mcp__agentcore__browser"],
};

export interface HostOptions {
  engine: AgentEngine;
  /** The role this runtime serves. An invocation for another role is refused. */
  role?: Role;
  env?: NodeJS.ProcessEnv;
  backoff?: BackoffOptions;
  timeoutMs?: number;
}

export class AgentHost {
  constructor(
    private d: CityDeps,
    private o: HostOptions,
  ) {}

  async ensureCore(): Promise<void> {
    const at = this.d.ledger.now().toISOString();
    for (const [id, role, model] of [
      ["ace", "Ace", "sonnet-5-5"],
      ["orchestrator", "Orchestrator", "fable-5-1"],
    ] as const) {
      if (!(await this.d.ledger.getAgent(id)))
        await this.d.ledger.putAgent({
          id,
          kind: "core",
          role,
          department: null,
          model,
          parent: id === "ace" ? null : "ace",
          state: "active",
          worker_state: null,
          total_cost_usd: 0,
          hired_at: at,
        });
    }
  }

  async runTurn(inv: Invocation): Promise<string> {
    if (this.o.role && this.o.role !== inv.role) throw new Error(`this runtime serves ${this.o.role}, not ${inv.role}`);
    const { ledger, bus } = this.d;
    try {
      await this.ensureCore();
      const agent = await ledger.getAgent(inv.agentId);
      if (!agent || agent.state === "retired") {
        log("warn", "turn.skipped", { agent: inv.agentId, reason: "no such agent or retired" });
        return "";
      }
      if (agent.state === "dormant") await ledger.updateAgent(agent.id, { state: "active" });
      const ticket = await ledger.getTicket(inv.ticketId);
      if (ticket?.status === "open" && ticket.to === agent.id)
        await move(this.d, ticket.id, "in_progress", "picked up");
      if (agent.kind === "worker" && agent.worker_state !== "working") {
        await ledger.updateAgent(agent.id, { worker_state: "working", ticket_id: inv.ticketId });
        await bus.put({ type: "worker.state", id: agent.id, state: "working" });
      }
      await bus.put({ type: "activity", id: agent.id, activity: "understanding" });

      const ctx: TurnCtx = {
        agentId: agent.id,
        role: inv.role,
        department: inv.department,
        ticketId: inv.ticketId,
        taskId: inv.taskId,
        conversation: inv.conversation,
      };
      const { system, builtins } = await this.system(agent, inv);
      const tools = gateTools(this.d, ctx, toolsFor(this.d, ctx));
      const prompt = await this.prompt(agent, inv);
      const models = resolveRoleFromEnv(inv.role, this.o.env ?? process.env);
      const settings = await this.d.settings();
      const isAce = inv.role === "ace";
      const result = await runGatedTurn(
        {
          kind: inv.role,
          role: inv.role,
          agentId: agent.id,
          sessionId: inv.sessionId,
          department: inv.department,
          ticketId: inv.ticketId,
          models,
          prompt,
          prefix: settings.profile_prefix,
          turnId: inv.id,
          timeoutMs: this.o.timeoutMs,
        },
        {
          ledger,
          bus,
          settings,
          backoff: this.o.backoff,
          runner: (turn) =>
            this.o.engine({
              turn,
              system,
              tools,
              builtins,
              ctx,
              ledger,
              cwd: agent.kind === "worker" ? `/tmp/work/${agent.id}` : undefined,
              onNeedsApproval: (tool, input, needs) => fileApproval(this.d, ctx, tool, input, needs),
              onActivity: (activity, detail) => void bus.put({ type: "activity", id: agent.id, activity, detail }),
              onText:
                isAce && inv.conversation
                  ? (text) => void bus.put({ type: "ace.reply", conversation: inv.conversation!, text, done: false })
                  : undefined,
            }),
        },
      );
      if (isAce && inv.conversation)
        await bus.put({ type: "ace.reply", conversation: inv.conversation, text: result.output.text, done: true });
      await bus.put({ type: "activity", id: agent.id, activity: "idle" });
      await ledger.finishWork(inv.id);
      return result.output.text;
    } finally {
      if (inv.role === "worker" && inv.department) await ledger.releaseWorkerSlot(inv.department);
    }
  }

  private async system(agent: AgentRecord, inv: Invocation): Promise<{ system: string; builtins: string[] }> {
    switch (inv.role) {
      case "ace":
        return { system: loadPrompt("ace.md").body, builtins: [] };
      case "orchestrator":
        return { system: loadPrompt("orchestrator.md").body, builtins: [] };
      case "manager": {
        const dept = await this.d.ledger.getDepartment(inv.department ?? "");
        return {
          system: loadPrompt("manager.md", {
            id: agent.id,
            department: dept?.name ?? "",
            mission: dept?.mission ?? "",
            department_template: departmentTemplate(dept?.name ?? ""),
          }).body,
          builtins: [],
        };
      }
      case "worker": {
        const spec = await this.d.ledger.table.get(`AGENT#${agent.id}`, "SPEC");
        const granted = (spec?.tools as string[] | undefined) ?? [];
        const builtins = [...new Set(granted.flatMap((t) => WORKER_BUILTINS[t] ?? []))];
        return {
          system: loadPrompt("worker.md", {
            id: agent.id,
            specialty: agent.specialty ?? agent.role,
            parent: agent.parent ?? managerId(inv.department ?? ""),
            instructions: String(spec?.instructions ?? ""),
            tools: granted.join(", "),
          }).body,
          builtins,
        };
      }
    }
  }

  /** The turn's input: the message, plus what the ledger says now, so a re-run after a crash carries on. */
  private async prompt(agent: AgentRecord, inv: Invocation): Promise<string> {
    const { ledger } = this.d;
    const lines = [`Message (${inv.kind}) from ${inv.from}:`, inv.body, "", "Current state from the ledger:"];
    if (inv.role === "orchestrator") {
      const task = await ledger.getTicket(inv.taskId);
      lines.push(`Task ${inv.taskId}: ${task?.goal ?? ""} [${task?.status ?? "?"}]`);
      lines.push(`Departments: ${(await ledger.listDepartments()).map((d) => d.name).join(", ") || "none yet"}`);
      for (const k of (await ledger.childTickets(inv.taskId)).filter((k) => k.kind === "assignment"))
        lines.push(`- ${k.department}: ${k.id} [${k.status}]`);
    } else if (inv.role === "manager") {
      const mine = await ledger.getTicket(inv.ticketId);
      lines.push(`Your goal ${inv.ticketId}: ${mine?.goal ?? ""} [${mine?.status ?? "?"}]`);
      const team = (await ledger.departmentAgents(inv.department ?? "")).filter(
        (a) => a.kind === "worker" && a.parent === agent.id && a.state !== "retired",
      );
      for (const w of team) lines.push(`- worker ${w.id} (${w.role}) state ${w.worker_state ?? "?"}`);
      for (const k of (await ledger.childTickets(inv.ticketId)).filter((k) => k.kind === "assignment"))
        lines.push(`- assignment ${k.id} to ${k.to} [${k.status}], review rounds ${k.review_rounds}`);
      const saved = (await ledger.listSpecialists()).filter((s) => s.department === inv.department);
      if (saved.length) lines.push(`Saved specialists: ${saved.map((s) => `${s.id} (${s.specialty})`).join(", ")}`);
    } else if (inv.role === "worker") {
      const t = await ledger.getTicket(inv.ticketId);
      lines.push(
        `Your assignment ${inv.ticketId}: ${t?.goal ?? ""}\nAcceptance: ${t?.acceptance ?? ""} [${t?.status ?? "?"}]`,
      );
    }
    return lines.join("\n");
  }
}
