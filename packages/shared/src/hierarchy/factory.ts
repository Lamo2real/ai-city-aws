// The Agent Factory and Registry: validates a hire spec against policy and department ceilings,
// writes the agent record, and releases workers. There is no limit on how many workers a department
// hires; only concurrency ceilings, AWS quotas and spend caps limit how many run at once.
import { z } from "zod";
import { departmentCap } from "../caps.ts";
import type { AgentRecord, EventBus } from "../events.ts";
import { departmentKey, newId } from "../ids.ts";
import type { CitySettings, Ledger } from "../ledger.ts";

/** Tools a worker may be granted. Shell and files run inside the worker's own microVM. */
export const WORKER_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "code_interpreter",
  "browser",
  "git",
] as const;

export const HireSpec = z.object({
  specialty: z.string().trim().min(3).max(80),
  instructions: z.string().trim().min(10).max(8000),
  tools: z.array(z.enum(WORKER_TOOLS)).min(1).max(WORKER_TOOLS.length),
  budget_hint_usd: z.number().positive().max(1000).optional(),
  /** Hire a saved specialist again: its instructions and tools are used, the spec's specialty names it. */
  specialist_id: z.string().optional(),
});
export type HireSpec = z.infer<typeof HireSpec>;

export class HireRefused extends Error {
  override name = "HireRefused";
}

export interface FactoryClient {
  hire(spec: HireSpec, managerId: string, department: string): Promise<AgentRecord>;
  release(workerId: string, managerId: string): Promise<AgentRecord>;
}

export class Factory implements FactoryClient {
  constructor(
    private ledger: Ledger,
    private bus: EventBus,
    private settings: () => Promise<CitySettings>,
  ) {}

  async hire(raw: HireSpec, managerId: string, department: string): Promise<AgentRecord> {
    const parsed = HireSpec.safeParse(raw);
    if (!parsed.success)
      throw new HireRefused(
        `The hire spec is not valid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    let spec = parsed.data;
    const dept = await this.ledger.getDepartment(department);
    if (!dept || dept.state !== "active") throw new HireRefused(`There is no active department called ${department}.`);
    if (dept.manager_id !== managerId) throw new HireRefused(`Only ${dept.name}'s manager can hire for it.`);
    const s = await this.settings();
    const cap = departmentCap(s, dept.name);
    if (spec.budget_hint_usd && cap !== null && spec.budget_hint_usd > cap)
      throw new HireRefused(
        `The budget hint of $${spec.budget_hint_usd} is above ${dept.name}'s daily cap of $${cap}.`,
      );
    if (spec.specialist_id) {
      const saved = await this.ledger.getSpecialist(spec.specialist_id);
      if (!saved) throw new HireRefused(`No saved specialist ${spec.specialist_id}.`);
      spec = {
        ...spec,
        instructions: saved.instructions,
        tools: saved.tools.filter((t): t is (typeof WORKER_TOOLS)[number] =>
          (WORKER_TOOLS as readonly string[]).includes(t),
        ),
      };
    }
    const at = this.ledger.now().toISOString();
    const agent: AgentRecord = {
      id: newId(`wkr-${departmentKey(dept.name)}`),
      kind: "worker",
      role: spec.specialty,
      specialty: spec.specialty,
      department: dept.name,
      model: "opus-5-5",
      parent: managerId,
      state: "active",
      worker_state: "hired",
      ticket_id: null,
      specialist_id: spec.specialist_id ?? null,
      total_cost_usd: 0,
      hired_at: at,
      last_active_at: at,
    };
    await this.ledger.putAgent(agent);
    // The spec is stored beside the record, so the worker's turns and save_specialist can read it.
    await this.ledger.table.put({
      pk: `AGENT#${agent.id}`,
      sk: "SPEC",
      instructions: spec.instructions,
      tools: spec.tools,
      budget_hint_usd: spec.budget_hint_usd ?? null,
    });
    await this.bus.put({ type: "agent.hired", agent });
    return agent;
  }

  async release(workerId: string, managerId: string): Promise<AgentRecord> {
    const a = await this.ledger.getAgent(workerId);
    if (!a || a.kind !== "worker") throw new HireRefused(`No worker ${workerId}.`);
    if (a.parent !== managerId) throw new HireRefused(`Only ${a.parent} can release ${workerId}.`);
    if (a.state === "retired") return a;
    const released = await this.ledger.updateAgent(workerId, { state: "retired", worker_state: "released" });
    await this.bus.put({ type: "agent.retired", id: workerId });
    return released;
  }
}

export async function workerSpec(
  ledger: Ledger,
  workerId: string,
): Promise<{ instructions: string; tools: string[] } | undefined> {
  const it = await ledger.table.get(`AGENT#${workerId}`, "SPEC");
  return it ? { instructions: String(it.instructions), tools: (it.tools as string[]) ?? [] } : undefined;
}
