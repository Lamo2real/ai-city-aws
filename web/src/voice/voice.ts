// Voice behind one small interface. Production: Amazon Transcribe streaming (speech → text, with a
// custom vocabulary for "Ace" and "AIC") and Amazon Polly (text → speech, neural voice), both called
// from the browser with short-lived credentials from a Cognito identity pool scoped to those two
// actions only. Tests inject a fake on window.__aicVoice. Transcribe and Polly are AWS speech
// services, not language models.
import { config } from "../lib/config.ts";
import { idToken } from "../lib/auth.ts";

export interface Voice {
  /** Starts listening; calls onText with each final transcript. Returns a function that stops. */
  listen(onText: (text: string) => void, onPartial?: (text: string) => void): Promise<() => void>;
  speak(text: string): Promise<void>;
  stopSpeaking(): void;
}

declare global {
  interface Window {
    __aicVoice?: Voice;
  }
}

const PCM_RATE = 16_000;

async function credentials() {
  const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-providers");
  const c = config();
  const token = await idToken();
  if (!token || !c.userPoolId) throw new Error("Voice needs you to be signed in.");
  return fromCognitoIdentityPool({
    clientConfig: { region: c.region },
    identityPoolId: c.identityPoolId,
    logins: { [`cognito-idp.${c.region}.amazonaws.com/${c.userPoolId}`]: token },
  });
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

class AwsVoice implements Voice {
  private audio: HTMLAudioElement | null = null;

  async listen(onText: (text: string) => void, onPartial?: (text: string) => void) {
    const { TranscribeStreamingClient, StartStreamTranscriptionCommand } =
      await import("@aws-sdk/client-transcribe-streaming");
    const c = config();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
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
    })().catch(() => undefined);
    return () => {
      open = false;
      wake?.();
      node.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  }

  async speak(text: string) {
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");
    const c = config();
    const client = new PollyClient({ region: c.region, credentials: await credentials() });
    const r = await client.send(
      new SynthesizeSpeechCommand({
        Engine: "neural",
        OutputFormat: "mp3",
        Text: text.slice(0, 2900),
        VoiceId: (c.pollyVoice || "Matthew") as never,
      }),
    );
    const bytes = await r.AudioStream?.transformToByteArray();
    if (!bytes) return;
    this.stopSpeaking();
    this.audio = new Audio(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "audio/mpeg" })));
    await new Promise<void>((resolve) => {
      this.audio!.onended = () => resolve();
      this.audio!.onerror = () => resolve();
      void this.audio!.play().catch(() => resolve());
    });
  }

  stopSpeaking() {
    this.audio?.pause();
    this.audio = null;
  }
}

let voice: Voice | null = null;
export const getVoice = (): Voice => (voice ??= window.__aicVoice ?? new AwsVoice());
