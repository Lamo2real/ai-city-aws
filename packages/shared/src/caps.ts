// The brake: checked before every turn of every kind. At a cap the city starts no new turns; turns
// already running finish within the turn timeout. Counters are DynamoDB items updated with ADD.
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

export function departmentCap(s: CitySettings, department: string): number {
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
  const [day, month] = await Promise.all([ledger.spend("day", "GLOBAL"), ledger.spend("month", "GLOBAL")]);
  if (month.usd >= settings.monthly_budget_usd)
    return block(
      "monthly",
      month.usd,
      settings.monthly_budget_usd,
      null,
      `This month's spend cap of $${settings.monthly_budget_usd} is reached.`,
    );
  if (day.usd >= settings.daily_global_usd)
    return block(
      "daily_global",
      day.usd,
      settings.daily_global_usd,
      null,
      `Today's spend cap of $${settings.daily_global_usd} is reached.`,
    );
  if (department) {
    const limit = departmentCap(settings, department);
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

/** Validates a cap change from Settings. Returns a plain-language problem, or null. */
export function validateCaps(
  patch: Partial<Pick<CitySettings, "daily_global_usd" | "monthly_budget_usd" | "daily_department_usd">>,
  confirmedHigh = false,
): string | null {
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
      return `${k.replace(/_/g, " ")} must be zero or more dollars.`;
  }
  if (!confirmedHigh) {
    if ((patch.daily_global_usd ?? 0) > CAPS_CONFIG.sanity_daily_cap_usd)
      return `A daily cap above $${CAPS_CONFIG.sanity_daily_cap_usd} needs an extra confirmation.`;
    if ((patch.monthly_budget_usd ?? 0) > CAPS_CONFIG.sanity_monthly_cap_usd)
      return `A monthly cap above $${CAPS_CONFIG.sanity_monthly_cap_usd} needs an extra confirmation.`;
  }
  return null;
}
