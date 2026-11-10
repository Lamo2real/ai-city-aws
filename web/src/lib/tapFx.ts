// Tap feedback everywhere in the HUD (the owner, 2026-11-09, decision 148): two amber rings ripple out from the
// point tapped, like a signal, with a soft click. One switch in Settings → General ("Tap sound and rings", on by
// default, remembered per device). Reduced motion keeps the click and drops the rings. Nothing here ever blocks a
// tap: the layer ignores pointers and the listener is passive.
const KEY = "vaic.tapfx";
export const RING_MS = 520;
export const SECOND_RING_DELAY_MS = 90;

export function tapFxOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setTapFx(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* this visit only */
  }
}

let ctx: AudioContext | null = null;
/** The tap sound (the owner, 2026-11-09: "a different kind of sound"): a soft glass "tink", like a fingertip on a
 *  glass pane. Two bell-like partials (2.6 kHz and its inharmonic 2.76× overtone) that ring for about 120 ms, the
 *  overtone fading first, very quiet. Made, not loaded; ios/scripts/make_tap_sound.py writes the same sound for the
 *  iPhone. */
export const TINK = [
  { hz: 2600, peak: 0.03, decay: 0.12 },
  { hz: 2600 * 2.76, peak: 0.012, decay: 0.05 },
] as const;
export function click() {
  try {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    for (const p of TINK) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(p.hz, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(p.peak, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + p.decay + 0.01);
    }
  } catch {
    /* no sound is fine */
  }
}

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function rings(x: number, y: number, root: HTMLElement = document.body) {
  if (reduced()) return;
  let layer = root.querySelector<HTMLElement>(":scope > .tapfx");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "tapfx";
    layer.setAttribute("aria-hidden", "true");
    root.appendChild(layer);
  }
  for (const delay of [0, SECOND_RING_DELAY_MS]) {
    const ring = document.createElement("span");
    ring.className = "tapfx-ring";
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.animationDelay = `${delay}ms`;
    layer.appendChild(ring);
    window.setTimeout(() => ring.remove(), RING_MS + delay + 50);
  }
}

/** Starts listening; returns the way to stop. */
export function installTapFx(): () => void {
  const on = (e: PointerEvent) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || !tapFxOn()) return;
    rings(e.clientX, e.clientY);
    click();
  };
  document.addEventListener("pointerdown", on, { capture: true, passive: true });
  return () => document.removeEventListener("pointerdown", on, { capture: true });
}
