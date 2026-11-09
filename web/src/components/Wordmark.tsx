import { useId } from "react";

// The logo (decision 161, replacing 159): the owner asked for GTA Vice City's style, so an original 80s Miami
// neon sign. A round sunset with stripes and a palm tree, then "VAIC" leaning like a sign, drawn as neon tubes
// (not a font, so it is the same everywhere): pink V and C, a cyan "ΛI", each with a soft glow and a white core.
// The colours are the --wm-pink / --wm-cyan / --wm-core tokens, deeper on the light theme so it reads.
const V = "M2 2 9 18 16 2";
const C = "M62 4.6a8 8 0 1 0 0 10.8";
const A = "M20 18 27 2 34 18";
const I = "M39.5 2v16";

export function Wordmark() {
  const id = useId().replace(/:/g, "");
  const sun = `wm-sun-${id}`;
  const clip = `wm-clip-${id}`;
  const glow = `wm-glow-${id}`;
  const tubes = (w: number) => (
    <g strokeWidth={w}>
      <g className="wm-pink">
        <path d={V} />
        <path d={C} />
      </g>
      <g className="wm-cyan">
        <path d={A} />
        <path d={I} />
      </g>
    </g>
  );
  return (
    <span className="wordmark">
      <svg className="wm-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd23f" />
            <stop offset="0.5" stopColor="#ff7a3d" />
            <stop offset="1" stopColor="#ff3ea5" />
          </linearGradient>
          <clipPath id={clip}>
            <circle cx="16" cy="16" r="15" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="32" height="32" fill={`url(#${sun})`} />
          <g fill="#2b1035">
            <rect y="18" width="32" height="1.3" />
            <rect y="21.2" width="32" height="1.8" />
            <rect y="24.6" width="32" height="2.4" />
            <rect y="28.4" width="32" height="4" />
            <path d="M20.6 32C20.4 25 19.4 18 17.6 12.6l1-.3C20.6 17.8 21.8 25 22 32z" />
            <path d="M18.2 12.4c-2.6-2-6-2.2-8.8-.6 3-.4 5.6.2 7.8 1.6z" />
            <path d="M18.2 12.4c-1.4-2.8-4.4-4.4-7.4-4 2.8.6 5 2 6.4 4.2z" />
            <path d="M18.2 12.4c.6-3 3-5 6.2-5.2-2.6 1-4.4 2.8-5.2 5.4z" />
            <path d="M18.2 12.4c2.6-1.4 6-1 8.2 1.2-2.8-.8-5.4-.6-7.6.6z" />
            <path d="M18.2 12.4c1.8.4 3.4 2 3.8 4-1-1.4-2.4-2.4-4-2.8z" />
          </g>
        </g>
      </svg>
      <svg className="wm-word" viewBox="0 0 70 20" width="84" height="24" role="img" aria-label="VAIC">
        <defs>
          <filter id={glow} x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        <g transform="skewX(-14) translate(5 0)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g filter={`url(#${glow})`} className="wm-halo">
            {tubes(4.4)}
          </g>
          {tubes(2.6)}
          <g className="wm-core" strokeWidth="1">
            <path d={V} />
            <path d={A} />
            <path d={I} />
            <path d={C} />
          </g>
        </g>
      </svg>
    </span>
  );
}
