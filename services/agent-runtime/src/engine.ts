// How a turn talks to the model. AgentEngine is the seam: production uses the Claude Agent SDK on
// Bedrock; tests use a scripted fake that calls the same tool handlers. The SDK's own refusal
// fallback is not used: the turn gate in @aic/shared does the one Fable → Opus retry.
import { gate, type TurnInput, type TurnOutput, type Usage, type Ledger } from "@aic/shared";
import type { ToolSpec, TurnCtx } from "./tools.ts";
import { CITY_SERVER, mcpName } from "./tools.ts";

export interface EngineRequest {
  turn: TurnInput;
  system: string;
  tools: ToolSpec[];
  /** Built-in SDK tools this agent may use (workers only), each still gated by canUseTool. */
  builtins: string[];
  ctx: TurnCtx;
  ledger: Ledger;
  /** Text as it streams, for Ace's spoken replies. */
  onText?: (chunk: string) => void;
  /** What the agent is doing, for the City view ("coding", "reading", ...). */
  onActivity?: (activity: string, detail?: string) => void;
  cwd?: string;
}
export type AgentEngine = (req: EngineRequest) => Promise<TurnOutput>;

const ACTIVITY: Array<[RegExp, string]> = [
  [/^(Write|Edit|MultiEdit)$/, "coding"],
  [/^(Read|Glob|Grep)$/, "reading"],
  [/^Bash$/, "running"],
  [/^(WebSearch|WebFetch)$/, "researching"],
  [/browser/, "browsing"],
  [/hire_worker/, "hiring"],
  [/assign|assign_to_department|delegate_to_orchestrator/, "delegating"],
  [/review|sign_off/, "reviewing"],
  [/report_to/, "reporting"],
  [/ask_owner|ask_manager/, "asking"],
  [/answer_/, "answering"],
];
export const activityFor = (tool: string): string => ACTIVITY.find(([re]) => re.test(tool))?.[1] ?? "working";

/** Usage from the SDK's per-model totals, split by cache-write lifetime. */
export function usageFromModelUsage(
  mu: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      cacheCreationEphemeral5mInputTokens?: number;
      cacheCreationEphemeral1hInputTokens?: number;
    }
  >,
  ttl: "5m" | "1h",
): Usage {
  const u: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
  for (const m of Object.values(mu)) {
    u.input += m.inputTokens;
    u.output += m.outputTokens;
    u.cacheRead += m.cacheReadInputTokens;
    const w5 = m.cacheCreationEphemeral5mInputTokens ?? 0;
    const w1 = m.cacheCreationEphemeral1hInputTokens ?? 0;
    const unknown = Math.max(0, m.cacheCreationInputTokens - w5 - w1);
    u.cacheWrite5m += w5 + (ttl === "5m" ? unknown : 0);
    u.cacheWrite1h += w1 + (ttl === "1h" ? unknown : 0);
  }
  return u;
}

/** The production engine: the Claude Agent SDK, on Bedrock, with the city tools in-process. */
export const sdkEngine: AgentEngine = async (req) => {
  const { query, tool, createSdkMcpServer } = await import("@anthropic-ai/claude-agent-sdk");
  const server = createSdkMcpServer({
    name: CITY_SERVER,
    version: "1.0.0",
    tools: req.tools.map((t) =>
      tool(t.name, t.description, t.input, async (args: Record<string, unknown>) => ({
        content: [{ type: "text" as const, text: await t.handler(args) }],
      })),
    ),
  });
  const allowed = [...req.tools.map((t) => mcpName(t.name)), ...req.builtins];
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ANTHROPIC_MODEL: req.turn.model.invokeId,
    ...(req.turn.cacheTtl === "1h" ? { ENABLE_PROMPT_CACHING_1H: "1" } : {}),
  };
  let text = "";
  let stop: TurnOutput["stopReason"] = "end_turn";
  let usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
  const abort = new AbortController();
  req.turn.signal?.addEventListener("abort", () => abort.abort());
  for await (const msg of query({
    prompt: req.turn.prompt,
    options: {
      model: req.turn.model.invokeId,
      systemPrompt: req.system, // stable text first, so prompt caching hits
      mcpServers: { [CITY_SERVER]: server },
      allowedTools: allowed,
      settingSources: [], // no settings files: the city decides tools, not the repo a worker clones
      resume: undefined,
      env,
      cwd: req.cwd,
      abortController: abort,
      canUseTool: async (name: string, input: Record<string, unknown>) => {
        if (!allowed.includes(name)) return { behavior: "deny" as const, message: `${name} is not one of your tools.` };
        const r = await gate(name, input, {
          role: req.ctx.role,
          agentId: req.ctx.agentId,
          consumeApproval: (h) => req.ledger.consumeApproval(h),
        });
        await req.ledger.auditTool(req.ctx.agentId, name, r.decision, r.reason);
        if (r.decision === "allow") req.onActivity?.(activityFor(name));
        return r.decision === "allow"
          ? { behavior: "allow" as const, updatedInput: input }
          : { behavior: "deny" as const, message: r.reason };
      },
    },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) if (block.type === "text") req.onText?.(block.text);
      if (msg.message.stop_reason === "refusal") stop = "refusal";
    } else if (msg.type === "result") {
      if (msg.subtype === "success") text = msg.result;
      if (msg.stop_reason === "refusal") stop = "refusal";
      else if (msg.stop_reason === "max_tokens") stop = "max_tokens";
      usage = usageFromModelUsage(msg.modelUsage, req.turn.cacheTtl);
      if (msg.subtype !== "success" && stop === "end_turn") throw new Error(`agent turn ended with ${msg.subtype}`);
    }
  }
  return { text, stopReason: stop, usage };
};
