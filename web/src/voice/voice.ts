// Voice behind one small interface. Production: Amazon Transcribe streaming (speech → text, with a
// custom vocabulary for "AIC") and Amazon Polly (text → speech, neural voice), both called
// from the browser with short-lived credentials from a Cognito identity pool scoped to those two
// actions only. Tests inject a fake on window.__aicVoice. Transcribe and Polly are AWS speech
// services, not language models.
import { config } from "../lib/config.ts";
import { idToken } from "../lib/auth.ts";
import { readVoiceId } from "./modes.ts";
import { speakable } from "./speech.ts";
import { toast } from "../components/ui.tsx";
import {
  browserListen,
  browserSpeechAvailable,
  canFallBack,
  rememberBrowserSpeech,
  usingBrowserSpeech,
} from "./browserSpeech.ts";

export interface Voice {
  /** Starts listening; calls onText with each final transcript and onError if the stream breaks later.
   *  Returns a function that stops. */
  listen(
    onText: (text: string) => void,
    onPartial?: (text: string) => void,
    onError?: (error: unknown) => void,
  ): Promise<() => void>;
  /** Called synchronously inside the owner's tap, before anything async: Safari only lets audio start there. */
  prime?(): void;
  /** Says a whole text at once (fakes; and the fallback when synth/play are missing). */
  speak(text: string): Promise<void>;
  /** One sentence to audio, and playing a clip: AIC's replies are spoken sentence by sentence with these.
   *  `onBegin` fires when sound really starts, so the HUD can show "speaking" only while audio plays. */
  synth?(text: string): Promise<Blob | null>;
  play?(clip: Blob, onBegin?: () => void): Promise<void>;
  stopSpeaking(): void;
  /** Loudness right now, 0..1: the owner's microphone and AIC's spoken reply. Drives the voice visualizer. */
  levels?(): { input: number; output: number };
}

const awsSays = (e: unknown) => {
  const m = ((e as { message?: string } | null)?.message ?? "").trim();
  return m ? `: ${m.slice(0, 140)}` : "";
};

/** Plain words for why the microphone or the speech service failed, with what to do next. */
export function micProblem(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? "";
  const synthetic = (e as { $metadata?: { websocketSynthetic500Error?: boolean } } | null)?.$metadata
    ?.websocketSynthetic500Error;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked for this site. Allow it in the browser (Safari: Settings for this website → Microphone → Allow; also System Settings → Privacy & Security → Microphone), then tap the mic again. Typing works meanwhile.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Plug one in or pick one in the system sound settings, then tap the mic again.";
    case "NotReadableError":
    case "AbortError":
      return "Another app is using the microphone. Close it, then tap the mic again.";
    case "NoMicSupport":
      return "This browser cannot use the microphone here. Open AI City in a current Safari, Chrome or Firefox over https.";
    case "SignedOut":
      return "Voice needs a fresh sign-in. Sign out and in again, then tap the mic.";
    case "NotAuthorizedException":
    case "InvalidIdentityPoolConfigurationException":
    case "ResourceNotFoundException":
    case "AccessDeniedException":
    case "UnrecognizedClientException":
    case "ExpiredTokenException":
      return `The speech service turned AI City down (${name}${awsSays(e)}). The microphone itself is fine. Typing works meanwhile.`;
    case "BadRequestException":
      return "The speech service refused the request (BadRequestException), for example while its word list is still updating. Try again in a minute.";
    case "BrowserSpeechNetwork":
      return "Your browser's speech recognition could not reach its service. Check the connection, or type instead.";
    case "NoBrowserSpeech":
    case "BrowserSpeechError":
      return `Speech recognition did not work in this browser (${name}${awsSays(e)}). Type instead, or try Safari or Chrome.`;
    case "StreamEnded":
      return "Listening stopped because the speech service closed the connection. Tap the mic to talk again.";
    case "LimitExceededException":
    case "ThrottlingException":
      return "The speech service is busy. Try again in a moment.";
  }
  if (synthetic)
    return "The speech service could not be reached (its connection did not open). Check the connection and try again.";
  const msg = ((e as { message?: string } | null)?.message ?? "").trim();
  if (/Importing a module script failed|dynamically imported module|Loading chunk|ChunkLoadError/i.test(msg))
    return "AI City was updated since this page opened. Reload the page to use the microphone.";
  if (name === "AudioSuspended")
    return "The browser kept audio paused, so the microphone could not start. Tap the mic again.";
  if (name === "InvalidStateError" || name === "NotSupportedError")
    return `The browser's audio could not start (${name}${awsSays(e)}). Reload the page and tap the mic again.`;
  if (name === "TypeError" && /load failed|failed to fetch|network/i.test(msg))
    return "The speech service could not be reached (the browser blocked or lost the connection). Check the connection and try again.";
  if (name === "CredentialsProviderError")
    return `Voice could not get its speech sign-in (${name}${awsSays(e)}). Sign out and in again, then tap the mic.`;
  // Anything else: say what the browser said, so the cause is never hidden behind a generic sentence.
  return `The microphone could not start (${name || "Error"}${awsSays(e)}). Try again, or type instead.`;
}

/** Logs the real error so it can be diagnosed in the browser console. Never logs tokens. */
export function logVoiceError(where: string, e: unknown) {
  const err = e as { name?: string; message?: string; $metadata?: unknown } | null;
  console.error(`[AIC voice] ${where}:`, err?.name ?? "Error", err?.message ?? "", err?.$metadata ?? "", e);
}

const named = (name: string, message: string) => Object.assign(new Error(message), { name });

/** Plain words for why AIC's reply could not be spoken (Polly or its playback), shown on the voice line. */
export function speakProblem(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "AudioPlayError" || name === "NotAllowedError")
    return "The browser blocked the sound until you tap something. Tap the mic and ask again.";
  if (name === "SignedOut") return "AIC's voice needs a fresh sign-in. Sign out and in again.";
  if (name === "AudioSuspended") return "The browser kept sound paused. Tap the mic once, then ask again.";
  if (name === "EmptyAudio") return "The speech service returned no audio. Try another voice in Settings.";
  if (name === "DecodeError") return "The reply's audio arrived, but this browser could not decode it.";
  return `AIC's voice could not play (${name || "Error"}${awsSays(e)}). The text above is the answer; typing still works.`;
}

declare global {
  interface Window {
    __aicVoice?: Voice;
  }
}

const PCM_RATE = 16_000;

type Creds = { accessKeyId: string; secretAccessKey: string; sessionToken?: string; expiration?: Date };
type CredsProvider = () => Promise<Creds>;

/** Voice credentials from the identity pool, using the signed-in owner's ID token. If the identity pool
 *  refuses the token (NotAuthorizedException), it asks Cognito for a fresh token once and tries again. */
export function voiceCredentials(
  token: (fresh: boolean) => Promise<string | null>,
  provider: (token: string) => CredsProvider,
): CredsProvider {
  let current: Promise<CredsProvider> | null = null;
  const make = async (fresh: boolean) => {
    const t = await token(fresh);
    if (!t) throw named("SignedOut", "Voice needs you to be signed in.");
    return provider(t);
  };
  return async () => {
    current ??= make(false);
    try {
      return await (
        await current
      )();
    } catch (e) {
      if ((e as { name?: string })?.name !== "NotAuthorizedException") throw e;
      logVoiceError("the identity pool refused the sign-in token; retrying with a fresh one", e);
      current = make(true);
      return (await current)();
    }
  };
}

async function credentials(): Promise<CredsProvider> {
  const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-providers");
  const c = config();
  if (!c.userPoolId || !c.identityPoolId) throw named("SignedOut", "Voice is not set up for this site.");
  return voiceCredentials(idToken, (token) =>
    fromCognitoIdentityPool({
      clientConfig: { region: c.region },
      identityPoolId: c.identityPoolId,
      logins: { [`cognito-idp.${c.region}.amazonaws.com/${c.userPoolId}`]: token },
    }),
  );
}

function toPcm16(input: Float32Array, fromRate: number): Uint8Array {
  const ratio = fromRate / PCM_RATE;
  const out = new DataView(new ArrayBuffer(Math.floor(input.length / ratio) * 2));
  for (let i = 0; i < out.byteLength / 2; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0));
    out.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(out.buffer);
}

/** RMS loudness of an analyser's current window, scaled so speech lands roughly in 0.2..1. */
function loudness(a: AnalyserNode | null, buf: Float32Array<ArrayBuffer> | null): number {
  if (!a || !buf) return 0;
  a.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / buf.length) * 5);
}

class AwsVoice implements Voice {
  /** The clip playing right now: an AudioBufferSourceNode on the tap-unlocked output context. */
  private current: AudioBufferSourceNode | null = null;
  private playing = false;
  private meterNode: AnalyserNode | null = null;
  private polly: import("@aws-sdk/client-polly").PollyClient | null = null;
  private inMeter: AnalyserNode | null = null;
  private inBuf: Float32Array<ArrayBuffer> | null = null;
  private outCtx: AudioContext | null = null;
  private outMeter: AnalyserNode | null = null;
  private outBuf: Float32Array<ArrayBuffer> | null = null;
  private outFallback = false;

  levels() {
    let output = loudness(this.outMeter, this.outBuf);
    // When the reply cannot be routed through Web Audio, an envelope stands in so the visualizer still moves.
    if (this.outFallback && this.playing) {
      const t = performance.now() / 1000;
      output = 0.35 + 0.3 * Math.abs(Math.sin(t * 9) * Math.sin(t * 2.3));
    }
    return { input: loudness(this.inMeter, this.inBuf), output };
  }

  private primed: AudioContext | null = null;

  /** In the tap itself: create and resume the mic's AudioContext (and the reply's), which Safari otherwise keeps
   *  suspended once the permission prompt or any await has passed. */
  prime() {
    try {
      this.primed?.close().catch(() => undefined);
      this.primed = new AudioContext();
      void this.primed.resume().catch(() => undefined);
      // The output context is created and resumed inside the tap: Safari then lets clips decoded on it
      // play at any later moment, which a fresh, un-gestured element would not be allowed to do.
      this.outCtx ??= new AudioContext();
      void this.outCtx.resume().catch(() => undefined);
    } catch {
      this.primed = null; // listen() reports the real problem
    }
  }

  /** Transcribe first; if it refuses the stream before anything was heard, the browser's own speech recognition
   *  for the rest of this page session (browserSpeech.ts), with a one-time note. */
  async listen(onText: (text: string) => void, onPartial?: (text: string) => void, onError?: (e: unknown) => void) {
    if (usingBrowserSpeech() && browserSpeechAvailable()) return browserListen(onText, onPartial, onError);
    let heard = false;
    let switched = false;
    let stopNow: () => void = () => undefined;
    const toBrowser = (why: unknown) => {
      if (switched) return;
      switched = true;
      logVoiceError("Transcribe refused; using the browser's speech recognition", why);
      stopNow();
      rememberBrowserSpeech();
      toast({ text: "Using your browser's speech recognition.", tone: "info" });
      try {
        stopNow = browserListen(onText, onPartial, onError);
      } catch (e) {
        onError?.(e);
      }
    };
    const fallBackOr = (fail: (e: unknown) => void) => (e: unknown) =>
      !heard && canFallBack(e) && browserSpeechAvailable() ? toBrowser(e) : fail(e);
    try {
      stopNow = await this.transcribeListen(
        (t) => ((heard = true), onText(t)),
        (t) => ((heard = true), onPartial?.(t)),
        fallBackOr((e) => onError?.(e)),
      );
    } catch (e) {
      fallBackOr((x) => {
        throw x;
      })(e);
    }
    return () => stopNow();
  }

  private async transcribeListen(
    onText: (text: string) => void,
    onPartial?: (text: string) => void,
    onError?: (e: unknown) => void,
  ) {
    // Ask for the microphone first, still inside the tap, before any network or module loading: Safari is
    // stricter about prompts and audio that start long after the gesture.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw named("NoMicSupport", "navigator.mediaDevices.getUserMedia is not available");
    const ctx = this.primed ?? new AudioContext();
    this.primed = null;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      void ctx.close().catch(() => undefined);
      throw e;
    }
    let stopped = false;
    const release = () => {
      if (stopped) return;
      stopped = true;
      this.inMeter = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    };
    try {
      return await this.stream(ctx, stream, release, onText, onPartial, onError);
    } catch (e) {
      release();
      throw e;
    }
  }

  private async stream(
    ctx: AudioContext,
    stream: MediaStream,
    release: () => void,
    onText: (text: string) => void,
    onPartial?: (text: string) => void,
    onError?: (e: unknown) => void,
  ) {
    // Safari can leave resume() pending forever outside a tap: wait briefly, then say so instead of hanging.
    if (ctx.state !== "running")
      await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
    if (ctx.state !== "running") throw named("AudioSuspended", `AudioContext is ${ctx.state}`);
    const { TranscribeStreamingClient, StartStreamTranscriptionCommand } =
      await import("@aws-sdk/client-transcribe-streaming");
    const c = config();
    const source = ctx.createMediaStreamSource(stream);
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    source.connect(meter);
    this.inMeter = meter;
    this.inBuf = new Float32Array(meter.fftSize);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Uint8Array[] = [];
    let wake: (() => void) | null = null;
    let open = true;
    node.onaudioprocess = (ev) => {
      chunks.push(toPcm16(ev.inputBuffer.getChannelData(0), ctx.sampleRate));
      wake?.();
    };
    source.connect(node);
    node.connect(ctx.destination);
    async function* audio() {
      while (open) {
        if (!chunks.length) await new Promise<void>((r) => (wake = r));
        wake = null;
        const chunk = chunks.shift();
        if (chunk) yield { AudioEvent: { AudioChunk: chunk } };
      }
    }
    const client = new TranscribeStreamingClient({
      region: c.transcribeRegion || c.region,
      credentials: await credentials(),
    });
    const res = await client.send(
      new StartStreamTranscriptionCommand({
        LanguageCode: "en-US",
        MediaEncoding: "pcm",
        MediaSampleRateHertz: PCM_RATE,
        VocabularyName: c.transcribeVocabulary || undefined,
        AudioStream: audio(),
      }),
    );
    void (async () => {
      for await (const ev of res.TranscriptResultStream ?? []) {
        for (const r of ev.TranscriptEvent?.Transcript?.Results ?? []) {
          const text = r.Alternatives?.[0]?.Transcript ?? "";
          if (!text) continue;
          if (r.IsPartial) onPartial?.(text);
          else onText(text);
        }
      }
      if (open) throw named("StreamEnded", "the speech service closed the stream");
    })().catch((e: unknown) => {
      if (!open) return; // stopped on purpose
      logVoiceError("speech stream broke", e);
      onError?.(e);
    });
    return () => {
      open = false;
      wake?.();
      node.disconnect();
      source.disconnect();
      release();
    };
  }

  /** The analyser every clip plays through, so the voice line can follow AIC's loudness. Built once. */
  private ensureMeter(ctx: AudioContext): AudioNode {
    if (!this.meterNode) {
      try {
        const m = ctx.createAnalyser();
        m.fftSize = 1024;
        this.outBuf = new Float32Array(m.fftSize);
        m.connect(ctx.destination);
        this.meterNode = m;
        this.outFallback = false;
      } catch {
        this.outFallback = true; // the clip still plays; the wave uses a stand-in envelope
        return ctx.destination;
      }
    }
    return this.meterNode;
  }

  /** Polly's generative engine (the most human-sounding), in the region that offers it (config.pollyRegion). */
  async synth(text: string): Promise<Blob | null> {
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const c = config();
    this.polly ??= new PollyClient({ region: c.pollyRegion || c.region, credentials: await credentials() });
    const r = await this.polly.send(
      new SynthesizeSpeechCommand({
        // Every voice in VOICES has a generative variant, and eu-central-1 offers the generative engine for
        // all of them (docs: generative-voices, feature and region compatibility). MP3 decodes everywhere.
        Engine: "generative",
        OutputFormat: "mp3",
        Text: text.slice(0, 2900),
        VoiceId: readVoiceId(c.pollyVoice) as never,
      }),
    );
    const bytes = await r.AudioStream?.transformToByteArray();
    return bytes ? new Blob([bytes as BlobPart], { type: "audio/mpeg" }) : null;
  }

  /** Plays one Polly clip through the AudioContext the owner's tap unlocked, decoded with decodeAudioData
   *  (Safari blocks play() on fresh, un-gestured elements, and used to do so silently here). `onBegin` fires
   *  at the moment sound really starts; the promise resolves when the clip ends or is stopped. Every way this
   *  can fail throws with a name speakProblem() knows. */
  async play(clip: Blob, onBegin?: () => void) {
    const ctx = (this.outCtx ??= new AudioContext());
    if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
    if (ctx.state !== "running") throw named("AudioSuspended", `the sound context is ${ctx.state}`);
    const bytes = await clip.arrayBuffer();
    if (!bytes.byteLength) throw named("EmptyAudio", "the speech service returned no audio");
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(bytes);
    } catch (e) {
      throw named("DecodeError", `the clip could not be decoded (${(e as Error)?.message ?? String(e)})`);
    }
    this.stopSpeaking();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ensureMeter(ctx));
    this.current = src;
    await new Promise<void>((resolve, reject) => {
      src.onended = () => resolve(); // fires on the natural end and on stopSpeaking()
      try {
        src.start();
      } catch (e) {
        reject(named("AudioPlayError", `the clip could not start (${(e as Error)?.message ?? String(e)})`));
        return;
      }
      this.playing = true;
      this.outMeter = this.meterNode;
      onBegin?.();
    });
    this.playing = false;
    if (this.current === src) {
      this.current = null;
      this.outMeter = null;
    }
  }

  async speak(text: string) {
    const clip = await this.synth(speakable(text));
    if (clip) await this.play(clip);
  }

  stopSpeaking() {
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
    this.current = null;
    this.playing = false;
    this.outMeter = null;
  }
}

let voice: Voice | null = null;
export const getVoice = (): Voice => (voice ??= window.__aicVoice ?? new AwsVoice());
