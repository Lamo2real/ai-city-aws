// Optional brake. Caps are off by default (null = no limit, the owner's choice). When the owner sets one
// it is checked before every turn of every kind; at a cap the city starts no new turns and turns already
// running finish within the turn timeout. Spend counters (DynamoDB ADD) are kept either way for the HUD.
import { CAPS_CONFIG } from "./config.ts";
import { departmentKey } from "./ids.ts";
import type { CitySettings, Ledger, TurnKind } from "./ledger.ts";

export type CapName = "daily_global" | "daily_department" | "monthly";
export type CapCheck =
  { ok: true } | { ok: false; cap: CapName; spent: number; limit: number; department: string | null; message: string };

export const DEFAULT_SETTINGS: CitySettings = {
  paused: false,
  pause_reason: null,
  monthly_budget_usd: CAPS_CONFIG.monthly_budget_usd,
  daily_global_usd: CAPS_CONFIG.daily_global_usd,
  daily_department_usd: CAPS_CONFIG.daily_department_usd,
  department_caps: {},
  max_concurrent_workers_per_department: CAPS_CONFIG.max_concurrent_workers_per_department,
  max_concurrent_workers_global: CAPS_CONFIG.max_concurrent_workers_global,
  max_new_sessions_per_second: CAPS_CONFIG.max_new_sessions_per_second,
  profile_prefix: "global",
  notify_email: true,
  integrations: { github: false, google_calendar: false, gmail: false, spotify: false },
  first_run_done: false,
};

export function departmentCap(s: CitySettings, department: string): number | null {
  return s.department_caps[departmentKey(department)] ?? s.daily_department_usd;
}

export class SpendCapReached extends Error {
  override name = "SpendCapReached";
  constructor(readonly check: Extract<CapCheck, { ok: false }>) {
    super(check.message);
  }
}
export class CityPaused extends Error {
  override name = "CityPaused";
}

/** Every turn kind goes through here: ace, orchestrator, manager, worker, utility, compaction, eval. */
export async function checkCaps(
  ledger: Ledger,
  settings: CitySettings,
  _kind: TurnKind,
  department: string | null,
): Promise<CapCheck> {
  const monthly = settings.monthly_budget_usd;
  const daily = settings.daily_global_usd;
  if (monthly !== null || daily !== null) {
    const [day, month] = await Promise.all([ledger.spend("day", "GLOBAL"), ledger.spend("month", "GLOBAL")]);
    if (monthly !== null && month.usd >= monthly)
      return block("monthly", month.usd, monthly, null, `This month's spend cap of $${monthly} is reached.`);
    if (daily !== null && day.usd >= daily)
      return block("daily_global", day.usd, daily, null, `Today's spend cap of $${daily} is reached.`);
  }
  if (department) {
    const limit = departmentCap(settings, department);
    if (limit === null) return { ok: true };
    const d = await ledger.spend("day", `DEPT#${departmentKey(department)}`);
    if (d.usd >= limit)
      return block(
        "daily_department",
        d.usd,
        limit,
        department,
        `${department}'s daily spend cap of $${limit} is reached.`,
      );
  }
  return { ok: true };
}
function block(cap: CapName, spent: number, limit: number, department: string | null, message: string): CapCheck {
  return {
    ok: false,
    cap,
    spent,
    limit,
    department,
    message: `${message} No new work starts until the owner raises the cap or the period resets.`,
  };
}

/** Validates a cap change from Settings: null (no limit) or zero or more dollars. Returns a problem, or null. */
export function validateCaps(
  patch: Partial<Pick<CitySettings, "daily_global_usd" | "monthly_budget_usd" | "daily_department_usd">>,
): string | null {
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
      return `${k.replace(/_/g, " ")} must be zero or more dollars, or empty for no limit.`;
  }
  return null;
}
