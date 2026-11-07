// Plain-language formatting shared by every screen.
export const money = (usd: number | null | undefined): string =>
  usd === null || usd === undefined || Number.isNaN(usd)
    ? "—"
    : usd < 10
      ? `$${usd.toFixed(2)}`
      : `$${Math.round(usd).toLocaleString("en-US")}`;

export type Level = "ok" | "amber" | "red";
/** Amber at 80% of the cap, red at 100%. */
export function spendLevel(spent: number, cap: number): Level {
  if (cap <= 0 || spent >= cap) return "red";
  return spent / cap >= 0.8 ? "amber" : "ok";
}

export const levelWords: Record<Level, string> = { ok: "", amber: "close to your limit", red: "limit reached" };

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const tokensK = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
