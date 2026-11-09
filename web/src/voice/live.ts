// VAIC's real-time voice on OpenAI GPT-Live (the owner's choice, 2026-11-09, decision 128; docs/VOICE.md). GPT-Live
// listens and speaks at the same time (full duplex), so the owner can talk over it naturally; VAIC stays the brain.
// The browser makes a WebRTC offer, the API opens the call with the owner's key (POST /voice/live) and returns
// OpenAI's answer; audio then flows straight between the browser and OpenAI. Client delegation: when GPT-Live
// decides a request needs the backend, it sends `session.delegation.created`; the owner's words since the last
// request (from the input transcript) go to VAIC through the normal chat, and VAIC's answer goes back as
// `session.commentary.append`, which GPT-Live says in its own words. When this can't open, Nova Sonic takes over.
import { api } from "../lib/api.ts";
import { primedContext, type SonicCall } from "./sonic.ts";

export interface LiveHandlers {
  /** The owner's request, for VAIC; resolves with VAIC's answer (text to say). */
  ask(text: string): Promise<string>;
  /** The owner's words so far in this turn (for "stop listening"). */
  onUserWords(text: string): void;
  /** VAIC is working on a request (on) or answered (off). */
  onThinking(on: boolean): void;
  /** The voice is playing (on) or quiet (off). */
  onSpeaking(on: boolean): void;
  /** The call ended without the owner ending it. */
  onEnd(problem?: unknown): void;
}

const READY_TIMEOUT_MS = 12000;
const ICE_TIMEOUT_MS = 5000;
/** GPT-Live takes up to 500 tokens per append; about four characters a token, with room to spare. */
const MAX_ANSWER_CHARS = 1800;
/** The transcript can trail the delegation event by a moment: wait this long for the owner's last words. */
const WORDS_SETTLE_MS = 350;
const SPEAKING_LEVEL = 0.04;
const QUIET_MS = 450;

/** Whether to try GPT-Live. Off by default (the owner, 2026-11-09: use AWS's own voice, Nova Sonic): only when
 *  chosen (localStorage "aic.voice.engine" = "gpt-live"), and tests opt in with window.__aicLive. */
export function liveWanted(): boolean {
  const w = window as unknown as { __aicVoice?: unknown; __aicLive?: boolean };
  if (typeof RTCPeerConnection === "undefined") return false;
  if (w.__aicLive === true) return true;
  try {
    return !w.__aicVoice && localStorage.getItem("aic.voice.engine") === "gpt-live";
  } catch {
    return false;
  }
}

/** What VAIC answered, ready to be said: no Markdown, links or code, and within GPT-Live's limit. */
export function forSpeech(answer: string): string {
  const t = answer
    .replace(/```[\s\S]*?```/g, " (there's code in the chat) ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= MAX_ANSWER_CHARS
    ? t
    : `${t.slice(0, MAX_ANSWER_CHARS).replace(/\s+\S*$/, "")}… The rest is in the chat.`;
}

function loudness(a: AnalyserNode | null, buf: Float32Array<ArrayBuffer> | null): number {
  if (!a || !buf) return 0;
  a.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

/** Opens the call. Throws (so Nova Sonic can take over) when the key, the microphone or OpenAI isn't there. */
export async function startLive(h: LiveHandlers): Promise<SonicCall> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const pc = new RTCPeerConnection();
  // The context unlocked in the tap (Safari keeps a later one suspended, and the meters would read 0); shared with
  // Nova Sonic, so it is never closed here.
  const shared = primedContext();
  const ctx = shared ?? new AudioContext();
  void ctx.resume().catch(() => undefined);
  const audio = new Audio();
  audio.autoplay = true;
  let ended = false;
  let poll = 0;
  const cleanup = () => {
    if (ended) return false;
    ended = true;
    window.clearInterval(poll);
    for (const t of mic.getTracks()) t.stop();
    try {
      dc.close();
      pc.close();
    } catch {
      /* already closed */
    }
    audio.srcObject = null;
    if (ctx !== shared) void ctx.close().catch(() => undefined);
    return true;
  };

  // Levels for the voice line: the owner's microphone and GPT-Live's voice.
  const inA = ctx.createAnalyser();
  inA.fftSize = 512;
  ctx.createMediaStreamSource(mic).connect(inA);
  const inBuf = new Float32Array(inA.fftSize);
  let outA: AnalyserNode | null = null;
  let outBuf: Float32Array<ArrayBuffer> | null = null;
  pc.addEventListener("track", (e) => {
    const stream = e.streams[0] ?? new MediaStream([e.track]);
    audio.srcObject = stream;
    void audio.play().catch(() => undefined);
    outA = ctx.createAnalyser();
    outA.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(outA);
    outBuf = new Float32Array(outA.fftSize);
  });
  for (const t of mic.getAudioTracks()) pc.addTrack(t, mic);
  const dc = pc.createDataChannel("oai-events");

  let words = ""; // the owner's words since the last request
  let speaking = false;
  let heardBefore = 0; // how much of `words` was there when the voice started its reply
  let quietSince = 0;
  let asking = 0;
  let ready: (() => void) | null = null;
  let fail: ((e: unknown) => void) | null = null;
  const started = new Promise<void>((res, rej) => {
    ready = res;
    fail = rej;
  });

  const send = (msg: Record<string, unknown>) => {
    if (dc.readyState === "open") dc.send(JSON.stringify(msg));
  };

  const delegated = async (id: string) => {
    await new Promise((r) => window.setTimeout(r, WORDS_SETTLE_MS));
    const text = words.trim();
    words = "";
    if (!text) {
      send({
        type: "session.commentary.append",
        delegation_id: id,
        content: "I didn't catch the request. Ask the owner to say it again.",
      });
      return;
    }
    asking++;
    h.onThinking(true);
    let answer: string;
    try {
      answer = forSpeech(await h.ask(text));
    } catch (e) {
      answer = `VAIC couldn't answer that (${(e as Error)?.message || "no reason given"}).`;
    }
    asking--;
    if (!asking) h.onThinking(false);
    if (!ended && answer) send({ type: "session.commentary.append", delegation_id: id, content: answer });
  };

  dc.addEventListener("message", ({ data }) => {
    let e: {
      type?: string;
      delta?: string;
      delegation?: { id?: string; target?: string };
      error?: { message?: string };
      reason?: string;
    };
    try {
      e = JSON.parse(String(data));
    } catch {
      return;
    }
    switch (e.type) {
      case "session.started":
        ready?.();
        break;
      case "session.input_transcript.delta":
        words += e.delta ?? "";
        h.onUserWords(words.trim());
        break;
      case "session.delegation.created":
        if (e.delegation?.id) void delegated(e.delegation.id);
        break;
      case "error":
        if (!ready) break;
        fail?.(new Error(e.error?.message || "OpenAI refused the call"));
        break;
      case "session.closed":
        if (cleanup())
          h.onEnd(e.reason && e.reason !== "client_closed" ? new Error(`the call ended (${e.reason})`) : undefined);
        break;
    }
  });
  dc.addEventListener("close", () => {
    if (cleanup()) h.onEnd(new Error("the call was cut off"));
  });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" && cleanup()) h.onEnd(new Error("the connection to OpenAI failed"));
  });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (pc.iceGatheringState !== "complete") {
      await new Promise<void>((res) => {
        const done = () => {
          if (pc.iceGatheringState !== "complete") return;
          pc.removeEventListener("icegatheringstatechange", done);
          res();
        };
        pc.addEventListener("icegatheringstatechange", done);
        window.setTimeout(res, ICE_TIMEOUT_MS); // go with the candidates found so far
      });
    }
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new Error("the browser made no connection offer");
    const answer = await api<{ sdp: string }>("/voice/live", { method: "POST", body: { sdp } });
    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    await Promise.race([
      started,
      new Promise((_, rej) =>
        window.setTimeout(() => rej(new Error("OpenAI's voice didn't answer")), READY_TIMEOUT_MS),
      ),
    ]);
  } catch (e) {
    cleanup();
    throw e;
  }
  ready = null;
  fail = null;

  // Speaking or quiet, from GPT-Live's own voice level.
  poll = window.setInterval(() => {
    const lv = loudness(outA, outBuf);
    const now = performance.now();
    if (lv > SPEAKING_LEVEL) {
      quietSince = 0;
      if (!speaking) {
        heardBefore = words.length;
        h.onSpeaking((speaking = true));
      }
    } else if (speaking) {
      quietSince ||= now;
      if (now - quietSince > QUIET_MS) {
        // A reply ended: what the owner said before it was answered (small talk), so it doesn't ride along with
        // the next request; words said over the reply stay.
        words = words.slice(heardBefore);
        h.onSpeaking((speaking = false));
      }
    }
  }, 100);

  return {
    stop() {
      if (ended) return;
      send({ type: "session.close" });
      window.setTimeout(cleanup, 1500); // let OpenAI settle the call, then let go of the mic either way
    },
    levels: () => ({ input: loudness(inA, inBuf), output: loudness(outA, outBuf) }),
  };
}
