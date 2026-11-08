// Talking over AIC in the step-by-step voice: while AIC's reply plays, a quiet listener watches the microphone
// (with the browser's echo cancellation, so AIC's own voice from the speakers mostly cancels out). When the
// owner's voice stays clearly above the room's noise for a moment, AIC stops at once and the mic opens.
// The real-time voice (sonic.ts) does this on the server instead; this is the same promise for the fallback.

/** Loudness (0..1) above which a frame counts as speech, given the room's noise measured at the start. */
export function speechThreshold(noise: number): number {
  return Math.min(0.5, Math.max(0.06, noise * 3));
}

/** Feeds one frame's loudness; true once speech has lasted `holdMs` (short noises like a cough don't count). */
export function speechDetector(holdMs = 220, calibrateMs = 250) {
  let started: number | null = null;
  let noise = 0;
  let frames = 0;
  let since: number | null = null;
  return (level: number, now: number): boolean => {
    started ??= now;
    if (now - started < calibrateMs) {
      noise = (noise * frames + level) / ++frames;
      return false;
    }
    if (level < speechThreshold(noise)) {
      since = null;
      return false;
    }
    since ??= now;
    return now - since >= holdMs;
  };
}

/** Starts watching the mic; calls onSpeech once when the owner talks. Returns a stop function. Never throws:
 *  without a microphone it simply does nothing. */
export function watchForBargeIn(onSpeech: () => void): () => void {
  let stopped = false;
  let cleanup = () => undefined as void;
  void (async () => {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      if (stopped) return mic.getTracks().forEach((t) => t.stop());
      const ctx = new AudioContext();
      const meter = ctx.createAnalyser();
      meter.fftSize = 512;
      ctx.createMediaStreamSource(mic).connect(meter);
      const buf = new Float32Array(meter.fftSize);
      const heard = speechDetector();
      const timer = window.setInterval(() => {
        meter.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        if (heard(Math.min(1, Math.sqrt(sum / buf.length) * 4), performance.now())) {
          cleanup();
          onSpeech();
        }
      }, 30);
      cleanup = () => {
        window.clearInterval(timer);
        mic.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => undefined);
        cleanup = () => undefined;
      };
      if (stopped) cleanup();
    } catch {
      /* no microphone: no talking over, the reply plays to the end as before */
    }
  })();
  return () => {
    stopped = true;
    cleanup();
  };
}
