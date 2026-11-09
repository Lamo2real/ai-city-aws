// AIC's real-time voice (decision 120, docs/VOICE.md): Amazon Nova 2 Sonic listens and speaks, AIC stays the
// brain. The browser asks the API for a five-minute signed address to AIC's own runtime, opens a WebSocket
// to it, streams the microphone up as 16 kHz PCM and plays Sonic's 24 kHz speech as it arrives. When the
// owner talks over it, Sonic says "interrupted" and every queued sound stops at once (barge-in).
// The microphone is read with a ScriptProcessor, which needs no extra script file (the HUD's CSP is strict).
import { api } from "../lib/api.ts";
import { base64ToFloats, pcmToBase64, toPcm16k } from "./pcm.ts";

export interface SonicHandlers {
  /** What the owner said (Sonic's final transcript). */
  onUserText(text: string): void;
  /** What Sonic said; `aic` is true when it was saying AIC's answer, which reaches the chat on its own. */
  onAssistantText(text: string, aic: boolean): void;
  /** AIC is working on a request (on) or answered (off). */
  onThinking(on: boolean): void;
  /** Sonic's voice is playing (on) or quiet (off). */
  onSpeaking(on: boolean): void;
  /** The call ended without the owner ending it. */
  onEnd(problem?: unknown): void;
}

export interface SonicCall {
  stop(): void;
  levels(): { input: number; output: number };
}

const OUT_RATE = 24000;
const READY_TIMEOUT_MS = 12000;

let primed: AudioContext | null = null;

/** Inside the owner's tap, before anything async: Safari only lets audio start there. */
export function primeSonic() {
  try {
    if (!primed || primed.state === "closed") primed = new AudioContext();
    void primed.resume().catch(() => undefined);
  } catch {
    primed = null;
  }
}

/** The AudioContext unlocked in the tap, for GPT-Live's level meters; Sonic still takes it if GPT-Live fails. */
export function primedContext(): AudioContext | null {
  return primed && primed.state !== "closed" ? primed : null;
}

/** Whether to try the real-time voice: always, except under a test's fake voice that did not ask for it. */
export function sonicWanted(): boolean {
  const w = window as unknown as { __aicVoice?: unknown; __aicSonic?: boolean };
  if (typeof WebSocket === "undefined") return false;
  if (w.__aicSonic === true) return true;
  // Off by default (the owner, 2026-11-09: "use the old way that worked"): the conversation runs on the standard
  // voice (Transcribe + Polly) until Nova Sonic is switched on, once the AWS account allows it (Bedrock answered
  // AccessDenied). Switch on: localStorage "aic.voice.engine" = "nova-sonic".
  try {
    return !w.__aicVoice && localStorage.getItem("aic.voice.engine") === "nova-sonic";
  } catch {
    return false;
  }
}

function loudness(a: AnalyserNode | null, buf: Float32Array<ArrayBuffer> | null): number {
  if (!a || !buf) return 0;
  a.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

/** Opens the call. Throws (so the old voice loop can take over) when the address, the microphone or the
 *  runtime cannot be reached. */
export async function startSonic(h: SonicHandlers): Promise<SonicCall> {
  const { url } = await api<{ url: string }>("/voice/session", { method: "POST" });
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = primed && primed.state !== "closed" ? primed : new AudioContext();
  primed = null;
  void ctx.resume().catch(() => undefined);
  const ws = new WebSocket(url);
  let ended = false;
  const cleanup = () => {
    if (ended) return false;
    ended = true;
    for (const t of mic.getTracks()) t.stop();
    hush();
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    void ctx.close().catch(() => undefined);
    return true;
  };

  // Sonic's speech: each chunk is scheduled right after the one before; barge-in stops them all.
  const outMeter = ctx.createAnalyser();
  outMeter.fftSize = 512;
  outMeter.connect(ctx.destination);
  const outBuf = new Float32Array(outMeter.fftSize);
  const playing = new Set<AudioBufferSourceNode>();
  let next = 0;
  let speaking = false;
  let quiet: number | undefined;
  const setSpeaking = (on: boolean) => {
    if (speaking === on) return;
    speaking = on;
    h.onSpeaking(on);
  };
  function hush() {
    for (const s of playing) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* not started */
      }
    }
    playing.clear();
    next = 0;
    window.clearTimeout(quiet);
    setSpeaking(false);
  }
  const play = (b64: string) => {
    const samples = base64ToFloats(b64);
    if (!samples.length) return;
    const buf = ctx.createBuffer(1, samples.length, OUT_RATE);
    buf.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(outMeter);
    const at = Math.max(ctx.currentTime + 0.02, next);
    src.start(at);
    next = at + buf.duration;
    playing.add(src);
    window.clearTimeout(quiet);
    setSpeaking(true);
    src.onended = () => {
      playing.delete(src);
      if (!playing.size) quiet = window.setTimeout(() => !playing.size && setSpeaking(false), 250);
    };
  };

  // The microphone, through a meter, to 16 kHz frames on the socket.
  const source = ctx.createMediaStreamSource(mic);
  const inMeter = ctx.createAnalyser();
  inMeter.fftSize = 512;
  const inBuf = new Float32Array(inMeter.fftSize);
  source.connect(inMeter);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);
  proc.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const pcm = toPcm16k(e.inputBuffer.getChannelData(0), ctx.sampleRate);
    ws.send(JSON.stringify({ type: "audio", data: pcmToBase64(pcm) }));
  };

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => fail(new Error("AIC's voice did not answer in time.")), READY_TIMEOUT_MS);
    let ready = false;
    const fail = (e: unknown) => {
      window.clearTimeout(timer);
      if (!ready) {
        cleanup();
        reject(e);
      } else if (cleanup()) h.onEnd(e);
    };
    ws.onmessage = (ev) => {
      let m: {
        type?: string;
        data?: string;
        role?: string;
        text?: string;
        message?: string;
        aic?: boolean;
        on?: boolean;
      };
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (m.type) {
        case "ready":
          if (!ready) {
            ready = true;
            window.clearTimeout(timer);
            resolve();
          }
          return;
        case "audio":
          if (m.data) play(m.data);
          return;
        case "interrupted":
          hush(); // the owner is talking: stop at once and listen
          return;
        case "transcript":
          if (!m.text) return;
          if (m.role === "user") h.onUserText(m.text);
          else h.onAssistantText(m.text, m.aic === true);
          return;
        case "thinking":
          h.onThinking(m.on === true);
          return;
        case "error":
          fail(new Error(m.message || "AIC's voice stopped."));
          return;
        case "closed":
          if (ready && cleanup()) h.onEnd();
          return;
      }
    };
    // Browsers never say why a WebSocket was refused: ask the API, which repeats the handshake and reads AWS's answer.
    let checking = false; // the API is finding out why; the close that follows the error waits for it
    ws.onerror = () => {
      checking = true;
      void api<{ ok: boolean; reason: string }>("/voice/check", { method: "POST" }).then(
        (c) =>
          fail(
            new Error(c.reason ? `the connection was refused: ${c.reason}` : "The connection to AIC's voice broke."),
          ),
        () => fail(new Error("The connection to AIC's voice broke.")),
      );
    };
    ws.onclose = () =>
      ready ? cleanup() && h.onEnd() : checking ? undefined : fail(new Error("AIC's voice is not available."));
  });

  return {
    stop() {
      if (ended) return;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
      } catch {
        /* closing anyway */
      }
      cleanup();
    },
    levels: () => ({ input: loudness(inMeter, inBuf), output: loudness(outMeter, outBuf) }),
  };
}
