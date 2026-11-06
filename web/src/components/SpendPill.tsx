import { useHud } from "../lib/store.ts";
import { levelWords, money, spendLevel } from "../lib/format.ts";

/** "Today: $3.20 of $10" — always visible; amber at 80%, red at 100%; opens Costs. */
export function SpendPill({ onOpen }: { onOpen: () => void }) {
  const usage = useHud((s) => s.city.usage);
  const cap = useHud((s) => s.city.caps?.daily_global_usd ?? null);
  const spent = usage?.usd ?? 0;
  const level = cap === null ? "ok" : spendLevel(spent, cap);
  const text = cap === null ? `Today: ${money(spent)}` : `Today: ${money(spent)} of ${money(cap)}`;
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
