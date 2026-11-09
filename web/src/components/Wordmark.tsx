import { useId } from "react";

// The logo (decision 159, replacing 147 and 158): a striped sunset with a city skyline in front, the Vice City
// nod in VAIC's name, then "VAIC" drawn as lines rather than set in a font, so it looks the same on every device.
// The A is a crossbar-less Λ that mirrors the V, and the "AI" is amber with a four-point spark over the I. The
// amber reads the --wm-ai-top / --wm-ai-bottom tokens (deeper on the light theme); the V and C take the text colour.
export function Wordmark() {
  const id = useId().replace(/:/g, "");
  const sun = `wm-sun-${id}`;
  const clip = `wm-clip-${id}`;
  const ai = `wm-ai-${id}`;
  return (
    <span className="wordmark">
      <svg className="wm-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd98a" />
            <stop offset="0.55" stopColor="#f2b33d" />
            <stop offset="1" stopColor="#e07a3a" />
          </linearGradient>
          <clipPath id={clip}>
            <circle cx="16" cy="16" r="15" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="32" height="32" fill={`url(#${sun})`} />
          <g fill="#2a1a08">
            <rect y="14.6" width="32" height="1.1" />
            <rect y="17.6" width="32" height="1.5" />
            <rect y="20.8" width="32" height="1.9" />
            <path d="M0 32V24h3.5v-3h2.5v3h2V15.5h3.5V24h1.5V9.5h1.2V7h1.6v2.5h1.2V24h1.5v-6h3V24h1.5v-9h3.5V24h2v-2.5h3.5V32z" />
          </g>
        </g>
      </svg>
      <svg className="wm-word" viewBox="0 0 67 20" width="74" height="22" role="img" aria-label="VAIC">
        <defs>
          <linearGradient id={ai} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="20">
            <stop offset="0" className="wm-ai-top" />
            <stop offset="1" className="wm-ai-bottom" />
          </linearGradient>
        </defs>
        <g fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2 9 18 16 2" stroke="currentColor" />
          <path d="M20 18 27 2 34 18" stroke={`url(#${ai})`} />
          <path d="M39.5 7v11" stroke={`url(#${ai})`} />
          <path d="M63 4.6a8 8 0 1 0 0 10.8" stroke="currentColor" />
        </g>
        <path fill={`url(#${ai})`} d="M39.5-1.2l1.1 2.5 2.5 1.1-2.5 1.1-1.1 2.5-1.1-2.5-2.5-1.1 2.5-1.1z" />
      </svg>
    </span>
  );
}
