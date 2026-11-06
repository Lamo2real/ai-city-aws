// Utility calls on Haiku 5.5: the wake-word check for unclear transcripts, ticket titles and
// compaction summaries. Each is a gated turn (pause, caps, cost row) and every prompt stays well
// under Haiku's 100,000-token long-context tier.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { EventBus } from "./events.ts";
import type { CitySettings, Ledger } from "./ledger.ts";
import { resolveRoleFromEnv } from "./models.ts";
import { runGatedTurn, type ModelRunner } from "./turn.ts";

/** About 4 characters per token: 160k characters stays near 40k tokens, far below 100k. */
export const UTILITY_MAX_CHARS = 160_000;

const GREETING = String.raw`(?:yo|hi|hey|hello|hiya|ok|okay|morning|good (?:morning|afternoon|evening)|what'?s up|whats up|sup|how'?s it going|hows it going)`;
const NAME = String.raw`(?:ace|aic|a\.?\s?i\.?\s?c\.?)`;
const ADDRESSED = new RegExp(String.raw`^\s*(?:${GREETING}[\s,!.]*)?${NAME}\b`, "i");
const ENDS_WITH_NAME = new RegExp(String.raw`[,\s]${NAME}[\s?.!]*$`, "i");
const MENTIONS = new RegExp(String.raw`\b${NAME}\b|\bays\b|\bace's\b`, "i");

/** Plain matching first: "yes" and "no" are decided here, only "unclear" goes to Haiku. */
export function wakeMatch(transcript: string): "yes" | "no" | "unclear" {
  const t = transcript.trim().replace(/[“”"]/g, "");
  if (!t) return "no";
  if (ADDRESSED.test(t) || ENDS_WITH_NAME.test(t)) return "yes";
  return MENTIONS.test(t) ? "unclear" : "no";
}

const here = dirname(fileURLToPath(import.meta.url));
function utilityPrompt(name: string): string {
  const dir =
    process.env.AIC_AGENTS_DIR ??
    [join(here, "agents"), join(here, "..", "..", "..", "agents")].find((p) => existsSync(p)) ??
    join(here, "agents");
  return readFileSync(join(dir, "utility", `${name}.md`), "utf8").trim();
}

export interface UtilityDeps {
  ledger: Ledger;
  bus: EventBus;
  settings: CitySettings;
  runner: ModelRunner;
  env?: NodeJS.ProcessEnv;
}

export async function utilityTurn(
  kind: "wake-word" | "title" | "compaction",
  text: string,
  d: UtilityDeps,
): Promise<string> {
  const body = text.length > UTILITY_MAX_CHARS ? text.slice(-UTILITY_MAX_CHARS) : text;
  const r = await runGatedTurn(
    {
      kind: kind === "compaction" ? "compaction" : "utility",
      role: "utility",
      agentId: "utility",
      sessionId: "utility-calls-are-stateless-000000",
      department: null,
      ticketId: null,
      models: resolveRoleFromEnv("utility", d.env ?? process.env),
      prompt: `${utilityPrompt(kind)}\n\n<data>\n${body}\n</data>`,
      prefix: d.settings.profile_prefix,
      timeoutMs: 30_000,
    },
    { ledger: d.ledger, bus: d.bus, settings: d.settings, runner: d.runner },
  );
  return r.output.text.trim();
}

/** Wake check: plain match, then Haiku only for unclear cases. */
export async function isAddressedToAce(transcript: string, d: UtilityDeps): Promise<boolean> {
  const m = wakeMatch(transcript);
  if (m !== "unclear") return m === "yes";
  return /^yes\b/i.test(await utilityTurn("wake-word", transcript, d));
}

/** Haiku through Bedrock Converse with the Lambda's role. The system prompt is a cache point. */
export function bedrockConverseRunner(client: Pick<BedrockRuntimeClient, "send">): ModelRunner {
  return async (input) => {
    const r = await client.send(
      new ConverseCommand({
        modelId: input.model.invokeId,
        messages: [{ role: "user", content: [{ text: input.prompt }] }],
        inferenceConfig: { maxTokens: 1024 },
      }),
      { abortSignal: input.signal },
    );
    const text = (r.output?.message?.content ?? []).map((c) => ("text" in c ? (c.text ?? "") : "")).join("");
    const u = r.usage;
    return {
      text,
      stopReason:
        r.stopReason === "content_filtered" || r.stopReason === "guardrail_intervened"
          ? "refusal"
          : r.stopReason === "max_tokens"
            ? "max_tokens"
            : "end_turn",
      usage: {
        input: u?.inputTokens ?? 0,
        output: u?.outputTokens ?? 0,
        cacheRead: u?.cacheReadInputTokens ?? 0,
        cacheWrite5m: u?.cacheWriteInputTokens ?? 0,
        cacheWrite1h: 0,
      },
    };
  };
}
