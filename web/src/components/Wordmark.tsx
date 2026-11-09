// The logo (decisions 147, 158): an amber tile with a small skyline, then "VAIC" with the "AI" in it set apart:
// amber, a slight lean and a small spark, so Vice Artificial Intelligence City reads at a glance. The tile and the
// AI read the accent tokens, so they follow the design system (decision 142).
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wm-tile" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M3 21V12.5a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V21Z" />
          <path d="M9.4 21V6.2a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V21Z" />
          <path d="M11.6 5.2V2.4h.8v2.8Z" />
          <path d="M15.8 21V9.6a1 1 0 0 1 1-1H20a1 1 0 0 1 1 1V21Z" />
          <path d="M2 21h20v1.2H2Z" />
        </svg>
      </span>
      <span className="wm-word" aria-label="VAIC">
        V<span className="wm-ai">AI</span>C
      </span>
    </span>
  );
}
