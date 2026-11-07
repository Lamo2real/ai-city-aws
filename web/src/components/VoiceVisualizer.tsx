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
import { MicIcon } from "./ui.tsx";

export type Speaker = "you" | "aic" | "thinking" | "idle";
export const speakerOf = (p: Presence): Speaker =>
  p === "listening" ? "you" : p === "speaking" ? "aic" : p === "thinking" ? "thinking" : "idle";

const BARS = 36;
const COLOR = { you: "#2a56a8", aic: "#7a4a2a", aicSoft: "#c98f55", thinking: "#5f4636", idle: "#b9a37f" };
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function VoiceVisualizer(p: { presence: Presence; listening: boolean; onMic: () => void }) {
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
      const lv = still ? { input: 0.5, output: 0.5 } : (getVoice().levels?.() ?? { input: 0, output: 0 });
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
          : "Tap the mic or type";
  return (
    <div className={`voice voice-${speaker}`} ref={wrap} data-speaker={speaker}>
      <div className="voice-strip">
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      <div className="voice-row">
        <button
          type="button"
          className={`mic ${p.listening ? "on" : ""}`}
          onClick={p.onMic}
          aria-pressed={p.listening}
          aria-label={p.listening ? "Stop listening" : "Talk to AIC"}
        >
          <MicIcon size={26} />
        </button>
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
    </div>
  );
}
