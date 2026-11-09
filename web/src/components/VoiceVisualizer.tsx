// The voice strip under AIC's eye: who is talking, shown by shape, words and colour together (never colour alone).
//   you      → upright bars that follow the owner's microphone level, blue, "You're talking" / "Listening to you"
//   aic      → a smooth flowing wave that follows AIC's spoken reply (Polly), wood brown, "AIC is talking"
//   thinking → three dots travelling along the line, "AIC is thinking"
//   idle     → a flat, quiet line, "Tap the mic or type"
// Levels come from getVoice().levels() (Web Audio analysers on the mic and on the reply). With
// prefers-reduced-motion the strip draws one still picture per state instead of animating.
import { useEffect, useRef, useState } from "react";
import type { Presence } from "../lib/store.ts";
import { getVoice } from "../voice/voice.ts";
import { sonicLevels } from "../voice/useVoice.ts";
import { MicIcon } from "./ui.tsx";

export type Speaker = "you" | "aic" | "thinking" | "idle";
export const speakerOf = (p: Presence): Speaker =>
  p === "listening" ? "you" : p === "speaking" ? "aic" : p === "thinking" ? "thinking" : "idle";

const BARS = 36;
const COLOR = { you: "#2a56a8", aic: "#7a4a2a", aicSoft: "#c98f55", thinking: "#5f4636", idle: "#8a7458" };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function VoiceVisualizer(p: {
  presence: Presence;
  listening: boolean;
  onMic: () => void;
  /** The line and the words only, no mic button (the AIC screen's voice bar; the button is in the message box). */
  bare?: boolean;
  /** Which voice the conversation runs on (the voice bar's badge), and why the standard one. */
  engine?: { kind: "realtime" | "standard"; why?: string } | null;
}) {
  const speaker = speakerOf(p.presence);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [talking, setTalking] = useState(false); // the owner's voice is above the noise floor right now

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const still = reducedMotion();
    let smooth = 0;
    let loud = false;
    let raf = 0;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
      if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const mid = h / 2;
      const lv = still
        ? { input: 0.5, output: 0.5 }
        : (sonicLevels() ?? getVoice().levels?.() ?? { input: 0, output: 0 });
      const level = speaker === "you" ? lv.input : speaker === "aic" ? lv.output : 0;
      smooth += (level - smooth) * 0.25;
      wrap.current?.style.setProperty("--lvl", still ? "0" : smooth.toFixed(3));

      if (speaker === "you") {
        // Upright bars, tallest in the middle, all following the mic level right now.
        const gap = w / BARS;
        g.fillStyle = COLOR.you;
        for (let i = 0; i < BARS; i++) {
          const bell = Math.exp(-(((i - (BARS - 1) / 2) / (BARS / 3.2)) ** 2));
          const jitter = still
            ? 0.7 + 0.3 * Math.abs(Math.sin(i * 1.7))
            : 0.55 + 0.45 * Math.abs(Math.sin(t / 110 + i * 1.3));
          const v = (still ? 0.55 : smooth) * (0.3 + 0.7 * bell) * jitter;
          const bh = Math.max(4, v * (h - 8));
          g.beginPath();
          g.roundRect(i * gap + gap * 0.22, mid - bh / 2, gap * 0.56, bh, 3);
          g.fill();
        }
        const now = smooth > 0.12 ? true : smooth < 0.06 ? false : loud;
        if (now !== loud) setTalking((loud = now));
      } else if (speaker === "aic") {
        const amp = (still ? 0.6 : 0.12 + smooth) * (h / 2 - 6);
        const waves: Array<[string, number, number, number]> = [
          [COLOR.aicSoft, 0.55, 1.6, 2],
          [COLOR.aicSoft, 0.8, 2.3, 2],
          [COLOR.aic, 1, 1.1, 4],
        ];
        for (const [color, scale, freq, width] of waves) {
          g.strokeStyle = color;
          g.lineWidth = width;
          g.beginPath();
          for (let x = 0; x <= w; x += 4) {
            const edge = Math.sin((Math.PI * x) / w); // calm at both ends, full in the middle
            const y = mid + Math.sin((x / w) * Math.PI * 2 * freq + (still ? 0 : t / 260) * scale) * amp * scale * edge;
            if (x === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
      } else {
        g.strokeStyle = COLOR.idle;
        g.lineWidth = 2;
        g.setLineDash(speaker === "thinking" ? [2, 8] : []);
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(w, mid);
        g.stroke();
        g.setLineDash([]);
        if (speaker === "thinking") {
          g.fillStyle = COLOR.thinking;
          for (let i = 0; i < 3; i++) {
            const x = still ? w / 2 + (i - 1) * 22 : ((t / 9 + i * 26) % (w + 60)) - 30;
            g.beginPath();
            g.arc(x, mid, 6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      setTalking(false);
    };
  }, [speaker]);

  const words =
    speaker === "you"
      ? talking
        ? "You’re talking"
        : "Listening to you…"
      : speaker === "aic"
        ? "AIC is talking"
        : speaker === "thinking"
          ? "AIC is thinking…"
          : p.bare
            ? "Your turn: just talk"
            : "Tap the mic or type";
  return (
    <div className={`voice voice-${speaker}${p.bare ? " voice-bare" : ""}`} ref={wrap} data-speaker={speaker}>
      <div className="voice-strip">
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      {p.bare ? <Aurora speaker={speaker} /> : null}
      <div className="voice-row">
        {p.bare ? null : (
          <button
            type="button"
            className={`mic ${p.listening ? "on" : ""}`}
            onClick={p.onMic}
            aria-pressed={p.listening}
            aria-label={p.listening ? "Stop listening" : "Talk to AIC"}
          >
            <MicIcon size={26} />
          </button>
        )}
        {p.bare ? (
          // Unmistakable while the conversation is on: a live badge with a beating dot.
          <span className="voice-on-pill">
            <span className="voice-on-dot" aria-hidden="true" />
            {p.engine?.kind === "realtime" ? "Voice on · real-time" : p.engine ? "Voice on · standard" : "Voice on"}
          </span>
        ) : null}
        <p className="voice-label">
          {speaker === "you" || speaker === "aic" ? (
            <span className="voice-who" aria-hidden="true">
              {speaker === "you" ? "You" : "AIC"}
            </span>
          ) : null}
          <span aria-hidden="true">{words}</span>
          <span className="sr" role="status">
            {speaker === "you" ? "Listening to you" : words}
          </span>
        </p>
      </div>
      {p.bare && p.engine?.kind === "standard" && p.engine.why ? (
        <p className="voice-engine-why">Real-time voice didn't connect: {p.engine.why}</p>
      ) : null}
    </div>
  );
}

/** The dictation row's wave, like Claude's: a bar per moment of your voice scrolling left, dots while you are
 *  quiet. It reads the mic level (getVoice().levels().input) about 20 times a second. */
export function MicWave() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const still = reducedMotion();
    const hist: number[] = [];
    let raf = 0;
    let lastPush = 0;
    let smooth = 0;
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
      if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const level = getVoice().levels?.().input ?? 0;
      smooth += (level - smooth) * 0.4;
      const step = 5;
      const n = Math.max(1, Math.floor(w / step));
      while (hist.length < n) hist.unshift(0); // quiet dots across the whole row until you speak
      if (t - lastPush > 50 || still) {
        hist.push(still ? 0.5 : smooth);
        while (hist.length > n) hist.shift();
        lastPush = t;
      }
      g.fillStyle = getComputedStyle(c).color;
      const mid = h / 2;
      hist.forEach((v, i) => {
        const x = w - (hist.length - i) * step + 1;
        if (v < 0.06)
          g.fillRect(x, mid - 1, 2, 2); // quiet: a dot
        else {
          const bh = Math.max(4, Math.min(h - 2, v * (h - 2) * 1.6));
          g.fillRect(x, mid - bh / 2, 3, bh);
        }
      });
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className="mic-wave" aria-hidden="true" />;
}

/** The City dock's voice line (the owner's wish, 2026-11-09: subtle, integrated, a flat voice animation that
 *  shows who is speaking). One thin line: blue and rippling with your voice when you talk, brown and flowing with
 *  AIC's when AIC talks, a dot travelling along it while AIC thinks, flat when nobody does. */
export function FlatWave({ speaker }: { speaker: Speaker }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const still = reducedMotion();
    let smooth = 0;
    let raf = 0;
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
      if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const mid = h / 2;
      const lv = still
        ? { input: 0.4, output: 0.4 }
        : (sonicLevels() ?? getVoice().levels?.() ?? { input: 0, output: 0 });
      const level = speaker === "you" ? lv.input : speaker === "aic" ? lv.output : 0;
      smooth += (level - smooth) * 0.3;
      const amp = speaker === "you" || speaker === "aic" ? Math.min(1, 0.08 + smooth * 1.4) * (mid - 2) : 0;
      const freq = speaker === "you" ? 3.2 : 1.8;
      const speed = speaker === "you" ? 90 : 160;
      g.strokeStyle = speaker === "you" ? COLOR.you : speaker === "aic" ? COLOR.aic : COLOR.idle;
      g.lineWidth = 2;
      g.lineCap = "round";
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const edge = Math.sin((Math.PI * x) / w); // flat at both ends
        const y = mid + Math.sin((x / w) * Math.PI * 2 * freq - (still ? 0 : t / speed)) * amp * edge;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      if (speaker === "thinking") {
        g.fillStyle = COLOR.thinking;
        const x = still ? w / 2 : ((t / 8) % (w + 20)) - 10;
        g.beginPath();
        g.arc(x, mid, 3.5, 0, Math.PI * 2);
        g.fill();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [speaker]);
  return <canvas ref={canvas} className="flatwave" aria-hidden="true" />;
}

/** The voice conversation's light (the owner, 2026-11-09: an effect around the message box that follows how loud
 *  you speak, with AI City's own touch). An aurora rising from the message box: a soft horizon of light whose crest
 *  ripples and climbs with the voice level, a second, slower veil behind it, and sparks that drift up when the voice
 *  is loud. Blue while you talk, amber while AIC talks, a slow breathing glow while AIC thinks, a faint ember when
 *  nobody does. With reduced motion: one still glow per state. */
const AURORA = {
  you: ["79,143,214", "138,180,255"],
  aic: ["232,163,61", "249,201,118"],
  thinking: ["150,120,200", "200,170,240"],
  idle: ["200,170,120", "230,210,170"],
} as const;

export function Aurora({ speaker }: { speaker: Speaker }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const still = reducedMotion();
    const [deep, light] = AURORA[speaker];
    const sparks: Array<{ x: number; y: number; v: number; r: number; life: number }> = [];
    let smooth = 0;
    let raf = 0;
    const draw = (t: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
      if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const lv = still
        ? { input: 0.35, output: 0.35 }
        : (sonicLevels() ?? getVoice().levels?.() ?? { input: 0, output: 0 });
      const raw =
        speaker === "you"
          ? lv.input
          : speaker === "aic"
            ? lv.output
            : speaker === "thinking"
              ? 0.18 + 0.1 * Math.sin(t / 600)
              : 0.06;
      smooth += (Math.min(1, raw * 1.3) - smooth) * 0.1; // slow to rise and fall: calm, never jumpy
      const base = h * 0.62; // where the message box's top edge sits in this canvas
      const veil = (amp: number, speed: number, freq: number, alpha: number, color: string) => {
        const crest = base - (18 + amp * h * 0.32);
        const grad = g.createLinearGradient(0, crest - 30, 0, base + 20);
        grad.addColorStop(0, `rgba(${color},0)`);
        grad.addColorStop(0.45, `rgba(${color},${alpha * 0.55})`);
        grad.addColorStop(1, `rgba(${color},${alpha})`);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const u = x / w;
          const bell = Math.sin(Math.PI * u) ** 1.4; // tallest in the middle, flat at the sides
          const ripple = still
            ? 0
            : Math.sin(u * Math.PI * freq + t / speed) * 0.18 + Math.sin(u * 7 - t / (speed * 1.7)) * 0.06;
          g.lineTo(x, base - (base - crest) * bell * (0.85 + ripple * (0.3 + amp * 0.5)));
        }
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      };
      g.filter = "blur(22px)";
      veil(smooth * 0.7, 1400, 2, 0.24, light);
      veil(smooth, 900, 3, 0.4, deep);
      g.filter = "none";
      // Sparks: born at the crest when the voice is loud, drifting up and fading.
      if (!still && smooth > 0.45 && sparks.length < 6 && Math.random() < smooth * 0.05)
        sparks.push({
          x: w * (0.3 + Math.random() * 0.4),
          y: base - 16,
          v: 0.25 + Math.random() * 0.35,
          r: 0.8 + Math.random() * 0.8,
          life: 1,
        });
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!;
        s.y -= s.v;
        s.life -= 0.008;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        g.fillStyle = `rgba(${light},${s.life * 0.45})`;
        g.beginPath();
        g.arc(s.x + Math.sin((t + i * 97) / 300) * 4, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [speaker]);
  return <canvas ref={canvas} className="aurora" aria-hidden="true" data-speaker={speaker} />;
}
