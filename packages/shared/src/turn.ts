// One gate for every model turn: pause flag, spend caps, throttling back-off, the Fable → Opus
// fallback (exactly once), and the ledger cost row. Model runners are injected, so tests use fakes
// and never call Bedrock.
import { CityPaused, SpendCapReached, checkCaps } from "./caps.ts";
import { cacheSavingsUsd, estimateUsd, type Usage } from "./cost.ts";
import type { EventBus } from "./events.ts";
import type { CitySettings, Ledger, TurnKind, TurnRecord } from "./ledger.ts";
import type { ProfilePrefix, ResolvedModel, Role, RoleModels } from "./models.ts";

export interface TurnInput {
  role: Role;
  agentId: string;
  sessionId: string;
  model: ResolvedModel;
  cacheTtl: "5m" | "1h";
  prompt: string;
  signal?: AbortSignal;
}
export interface TurnOutput {
  text: string;
  /** "refusal" when the model declined; the gate then falls back once. */
  stopReason: "end_turn" | "refusal" | "max_tokens" | "tool_use";
  usage: Usage;
}
export type ModelRunner = (input: TurnInput) => Promise<TurnOutput>;

export class ModelUnavailable extends Error {
  override name = "ModelUnavailable";
}
export class TurnTimeout extends Error {
  override name = "TurnTimeout";
}

const THROTTLE =
  /ThrottlingException|TooManyRequests|ServiceUnavailable|ModelNotReady|\b429\b|\b503\b|rate.?exceeded|throttl/i;
export const isThrottle = (e: unknown): boolean =>
  THROTTLE.test(`${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? ""}`);
const UNAVAILABLE =
  /ModelUnavailable|ResourceNotFound|AccessDenied.*model|model.*not.*(available|enabled)|ValidationException.*model/i;
export const isUnavailable = (e: unknown): boolean =>
  e instanceof ModelUnavailable || UNAVAILABLE.test(`${(e as Error)?.name ?? ""} ${(e as Error)?.message ?? ""}`);

export interface BackoffOptions {
  retries?: number;
  baseMs?: number;
  capMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (attempt: number, delayMs: number) => void;
}
/** Full-jitter exponential back-off for throttling only. Throttling is never a pause. */
export async function withBackoff<T>(fn: () => Promise<T>, o: BackoffOptions = {}): Promise<T> {
  const retries = o.retries ?? 5,
    base = o.baseMs ?? 1000,
    cap = o.capMs ?? 30_000;
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const random = o.random ?? Math.random;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isThrottle(e) || attempt >= retries) throw e;
      const delay = Math.floor(random() * Math.min(cap, base * 2 ** attempt));
      o.onRetry?.(attempt + 1, delay);
      await sleep(delay);
    }
  }
}

export interface GatedTurn {
  kind: TurnKind;
  role: Role;
  agentId: string;
  sessionId: string;
  department: string | null;
  ticketId: string | null;
  models: RoleModels;
  prompt: string;
  prefix?: ProfilePrefix;
  /** For review and sign-off turns: a turn without a PASS/FAIL verdict counts as "no verdict". */
  needsVerdict?: boolean;
  timeoutMs?: number;
  turnId?: string;
}
export interface GateDeps {
  ledger: Ledger;
  bus: EventBus;
  runner: ModelRunner;
  settings: CitySettings;
  backoff?: BackoffOptions;
}
export interface GatedResult {
  output: TurnOutput;
  model: ResolvedModel;
  fallback: boolean;
  verdict: "PASS" | "FAIL" | null;
  usd: number;
}

/** A verdict counts only if the reply carries one on its own line or as JSON: PASS or FAIL. */
export function parseVerdict(text: string): "PASS" | "FAIL" | null {
  const t = text.trim();
  try {
    const j = JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { verdict?: unknown };
    if (j.verdict === "PASS" || j.verdict === "FAIL") return j.verdict;
  } catch {
    /* not JSON */
  }
  const m = /^\s*(?:verdict\s*:\s*)?(PASS|FAIL)\b/im.exec(t);
  return m ? (m[1] as "PASS" | "FAIL") : null;
}

export async function runGatedTurn(t: GatedTurn, d: GateDeps): Promise<GatedResult> {
  if (await d.ledger.isPaused())
    throw new CityPaused("The city is paused. No new turns start until the owner resumes it.");
  const cap = await checkCaps(d.ledger, d.settings, t.kind, t.department);
  if (!cap.ok) {
    await d.bus.put({
      type: "spend.cap_reached",
      cap: cap.cap,
      department: cap.department,
      spent: cap.spent,
      limit: cap.limit,
    });
    throw new SpendCapReached(cap);
  }

  const attempt = async (model: ResolvedModel): Promise<TurnOutput> => {
    const ctrl = new AbortController();
    const timeout = t.timeoutMs ?? 15 * 60_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        withBackoff(
          () =>
            d.runner({
              role: t.role,
              agentId: t.agentId,
              sessionId: t.sessionId,
              model,
              cacheTtl: t.models.cacheTtl,
              prompt: t.prompt,
              signal: ctrl.signal,
            }),
          d.backoff,
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            ctrl.abort();
            reject(new TurnTimeout(`turn timed out after ${Math.round(timeout / 60_000)} minutes`));
          }, timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const record = async (
    model: ResolvedModel,
    out: TurnOutput | null,
    fallback: boolean,
    outcome: TurnRecord["outcome"],
  ) => {
    const usage = out?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
    const usd = estimateUsd(model.name, usage, t.prefix);
    const { today } = await d.ledger.recordTurn({
      id: t.turnId ? `${t.turnId}${fallback ? "-fb" : ""}` : undefined,
      agent: t.agentId,
      role: t.role,
      department: t.department,
      ticket_id: t.ticketId,
      kind: t.kind,
      model: model.name,
      fallback,
      input: usage.input,
      output: usage.output,
      cache_read: usage.cacheRead,
      cache_write_5m: usage.cacheWrite5m,
      cache_write_1h: usage.cacheWrite1h,
      usd,
      cache_savings_usd: cacheSavingsUsd(model.name, usage, t.prefix),
      outcome,
    });
    const tokens = usage.input + usage.output + usage.cacheRead + usage.cacheWrite5m + usage.cacheWrite1h;
    if (out)
      await d.bus.put({
        type: "cost.update",
        agent: t.agentId,
        role: t.role,
        department: t.department,
        model: model.name,
        usd,
        tokens,
        today,
      });
    return usd;
  };

  const primary = t.models.primary;
  let why: TurnRecord["outcome"] = "ok";
  try {
    const first = await attempt(primary);
    const verdict = t.needsVerdict ? parseVerdict(first.text) : null;
    if (first.stopReason === "refusal") why = "refused";
    else if (t.needsVerdict && !verdict) why = "no_verdict";
    if (why === "ok" || !t.models.fallback) {
      const usd = await record(primary, first, false, why);
      return { output: first, model: primary, fallback: false, verdict, usd };
    }
    await record(primary, first, false, why);
  } catch (e) {
    if (!(isUnavailable(e) && t.models.fallback)) {
      await record(primary, null, false, e instanceof TurnTimeout ? "timeout" : "error");
      throw e;
    }
  }
  // Exactly one fallback turn. Whatever it returns is final: a refusal never loops.
  const fb = t.models.fallback!;
  const out = await attempt(fb);
  const verdict = t.needsVerdict ? parseVerdict(out.text) : null;
  const outcome: TurnRecord["outcome"] =
    out.stopReason === "refusal" ? "refused" : t.needsVerdict && !verdict ? "no_verdict" : "ok";
  const usd = await record(fb, out, true, outcome);
  return { output: out, model: fb, fallback: true, verdict, usd };
}
