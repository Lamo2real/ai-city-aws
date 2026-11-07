import { useHud } from "../lib/store.ts";
import { levelWords, money, spendLevel } from "../lib/format.ts";

/** "Today: $3.20" — always visible; opens Costs. A daily limit is named only once today's spend reaches half of
 *  it ("Today: $6.10 of $10"), amber at 80%, red at 100%: a far-away limit is noise, not information. */
export function SpendPill({ onOpen }: { onOpen: () => void }) {
  const usage = useHud((s) => s.city.usage);
  const cap = useHud((s) => s.city.caps?.daily_global_usd ?? null);
  const spent = usage?.usd ?? 0;
  const level = cap === null ? "ok" : spendLevel(spent, cap);
  const showCap = cap !== null && (cap <= 0 || spent >= cap / 2);
  const text = showCap ? `Today: ${money(spent)} of ${money(cap)}` : `Today: ${money(spent)}`;
  return (
    <button
      type="button"
      className={`spend spend-${level}`}
      onClick={onOpen}
      aria-label={`${text}, estimate${levelWords[level] ? `, ${levelWords[level]}` : ""}. Open costs.`}
      data-level={level}
    >
      <span aria-hidden="true">{level === "red" ? "■" : level === "amber" ? "▲" : "●"}</span> {text}
      {level !== "ok" ? <span className="spend-word"> · {levelWords[level]}</span> : null}
    </button>
  );
}
