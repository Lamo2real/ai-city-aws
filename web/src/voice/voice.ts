// Voice behind one small interface. Production: Amazon Transcribe streaming (speech → text, with a
// custom vocabulary for "AIC") and Amazon Polly (text → speech, neural voice), both called
// from the browser with short-lived credentials from a Cognito identity pool scoped to those two
// actions only. Tests inject a fake on window.__aicVoice. Transcribe and Polly are AWS speech
// services, not language models.
import { config } from "../lib/config.ts";
import { idToken } from "../lib/auth.ts";
import { readVoiceId } from "./modes.ts";
import { speakable } from "./speech.ts";

export interface Voice {
  /** Starts listening; calls onText with each final transcript and onError if the stream breaks later.
   *  Returns a function that stops. */
  listen(
    onText: (text: string) => void,
    onPartial?: (text: string) => void,
    onError?: (error: unknown) => void,
  ): Promise<() => void>;
  /** Says a whole text at once (fakes; and the fallback when synth/play are missing). */
  speak(text: string): Promise<void>;
  /** One sentence to audio, and playing a clip: AIC's replies are spoken sentence by sentence with these. */
  synth?(text: string): Promise<Blob | null>;
  play?(clip: Blob): Promise<void>;
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
    case "StreamEnded":
      return "Listening stopped because the speech service closed the connection. Tap the mic to talk again.";
    case "LimitExceededException":
    case "ThrottlingException":
      return "The speech service is busy. Try again in a moment.";
  }
  if (synthetic) return "The speech service could not be reached. Check the connection and try again.";
  return "The microphone could not start. Try again, or type instead.";
}

/** Logs the real error so it can be diagnosed in the browser console. Never logs tokens. */
export function logVoiceError(where: string, e: unknown) {
  const err = e as { name?: string; message?: string; $metadata?: unknown } | null;
  console.error(`[AIC voice] ${where}:`, err?.name ?? "Error", err?.message ?? "", err?.$metadata ?? "", e);
}

const named = (name: string, message: string) => Object.assign(new Error(message), { name });

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
  private audio: HTMLAudioElement | null = null;
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
    if (this.outFallback && this.audio && !this.audio.paused)
      output = 0.35 + 0.3 * Math.abs(Math.sin(this.audio.currentTime * 9) * Math.sin(this.audio.currentTime * 2.3));
    return { input: loudness(this.inMeter, this.inBuf), output };
  }

  async listen(onText: (text: string) => void, onPartial?: (text: string) => void, onError?: (e: unknown) => void) {
    // Ask for the microphone first, still inside the tap, before any network or module loading: Safari is
    // stricter about prompts and audio that start long after the gesture.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw named("NoMicSupport", "navigator.mediaDevices.getUserMedia is not available");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext();
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
    await ctx.resume().catch(() => undefined);
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
    const client = new TranscribeStreamingClient({ region: c.region, credentials: await credentials() });
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

  /** Routes the reply through an analyser when Web Audio is running; otherwise plays it directly. */
  private meterOutput(audio: HTMLAudioElement) {
    try {
      this.outCtx ??= new AudioContext();
      if (this.outCtx.state !== "running") void this.outCtx.resume().catch(() => undefined);
      if (this.outCtx.state !== "running") return void (this.outFallback = true); // never route into a muted context
      const src = this.outCtx.createMediaElementSource(audio);
      this.outMeter = this.outCtx.createAnalyser();
      this.outMeter.fftSize = 1024;
      this.outBuf = new Float32Array(this.outMeter.fftSize);
      src.connect(this.outMeter);
      this.outMeter.connect(this.outCtx.destination);
      this.outFallback = false;
    } catch {
      this.outFallback = true;
    }
  }

  /** Polly's generative engine (the most human-sounding), in the region that offers it (config.pollyRegion). */
  async synth(text: string): Promise<Blob | null> {
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const c = config();
    this.polly ??= new PollyClient({ region: c.pollyRegion || c.region, credentials: await credentials() });
    const r = await this.polly.send(
      new SynthesizeSpeechCommand({
        Engine: "generative",
        OutputFormat: "mp3",
        Text: text.slice(0, 2900),
        VoiceId: readVoiceId(c.pollyVoice) as never,
      }),
    );
    const bytes = await r.AudioStream?.transformToByteArray();
    return bytes ? new Blob([bytes as BlobPart], { type: "audio/mpeg" }) : null;
  }

  async play(clip: Blob) {
    this.stopSpeaking();
    const url = URL.createObjectURL(clip);
    const audio = new Audio(url);
    this.audio = audio;
    this.meterOutput(audio);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.onpause = () => resolve(); // stopSpeaking() pauses it
      void audio.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  }

  async speak(text: string) {
    const clip = await this.synth(speakable(text));
    if (clip) await this.play(clip);
  }

  stopSpeaking() {
    this.audio?.pause();
    this.audio = null;
    this.outMeter = null;
  }
}

let voice: Voice | null = null;
export const getVoice = (): Voice => (voice ??= window.__aicVoice ?? new AwsVoice());
