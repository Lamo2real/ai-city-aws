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
/** The tap sounds (the owner, 2026-11-10, picked from twenty samples): a round synth "bloop" for every tap that
 *  works, and a kalimba note (a thumb-piano tine) for a tap on something that can't be used right now (a disabled
 *  button) and when something goes wrong (an error toast, or an error banner right after a tap). Made, not loaded;
 *  ios/scripts/make_tap_sound.py writes the same two sounds for the iPhone. */
export const BLOOP = { type: "triangle", from: 220, to: 440, peak: 0.12, seconds: 0.12 } as const;
export const KALIMBA = { carrier: 784, ratio: 3.5, index: 1.2, peak: 0.12, seconds: 0.45 } as const;
export type TapSound = "ok" | "no";

function audio(): AudioContext | null {
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envelope(c: AudioContext, peak: number, seconds: number, t: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  g.connect(c.destination);
  return g;
}

export function click(sound: TapSound = "ok") {
  try {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    if (sound === "ok") {
      const o = c.createOscillator();
      o.type = BLOOP.type;
      o.frequency.setValueAtTime(BLOOP.from, t);
      o.frequency.exponentialRampToValueAtTime(BLOOP.to, t + BLOOP.seconds);
      o.connect(envelope(c, BLOOP.peak, BLOOP.seconds, t));
      o.start(t);
      o.stop(t + BLOOP.seconds + 0.02);
      return;
    }
    // the kalimba: a sine carrier whose brightness (FM index) falls away as the note rings
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const depth = c.createGain();
    car.frequency.value = KALIMBA.carrier;
    mod.frequency.value = KALIMBA.carrier * KALIMBA.ratio;
    depth.gain.setValueAtTime(KALIMBA.carrier * KALIMBA.index, t);
    depth.gain.exponentialRampToValueAtTime(1, t + KALIMBA.seconds);
    mod.connect(depth).connect(car.frequency);
    car.connect(envelope(c, KALIMBA.peak, KALIMBA.seconds, t));
    for (const o of [car, mod]) {
      o.start(t);
      o.stop(t + KALIMBA.seconds + 0.02);
    }
  } catch {
    /* no sound is fine */
  }
}

let lastTap = 0;
let lastRefusal = 0;
/** Something went wrong: the kalimba, once (never twice within a second), when tap sounds are on. ``afterTap``: only
 *  if the owner tapped in the last few seconds, so a problem found in the background never makes a sound. */
export function refusal(afterTap = false) {
  const now = Date.now();
  if (!tapFxOn() || now - lastRefusal < 1000 || (afterTap && now - lastTap > 4000)) return;
  lastRefusal = now;
  click("no");
}

const CONTROL =
  'button, a[href], input, select, textarea, summary, label, [role="button"], [role="link"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"]';
/** Which sound a tap on this element gets: "no" on a control that is switched off, else "ok". */
export function tapSound(target: EventTarget | null): TapSound {
  const el = target instanceof Element ? target.closest(CONTROL) : null;
  if (!el) return "ok";
  const off =
    el.matches(":disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.closest("[aria-disabled='true'], fieldset:disabled") !== null;
  return off ? "no" : "ok";
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
    const sound = tapSound(e.target);
    lastTap = Date.now();
    if (sound === "no") lastRefusal = lastTap; // one sound per tap: an error from this tap stays quiet
    click(sound);
  };
  document.addEventListener("pointerdown", on, { capture: true, passive: true });
  return () => document.removeEventListener("pointerdown", on, { capture: true });
}
