// VAIC's voice through OpenAI text-to-speech (docs/VOICE.md), with Amazon Polly behind it.
//   status:   GET /voice/openai, loaded once per page (and again after the key is saved).
//   speech:   POST /speech per sentence → MP3 bytes, played by the same strict in-order player as Polly clips.
//   fallback: not configured → Polly, silently. A failure → Polly for the rest of the page session, said once
//             on the voice line; saving a key or a successful Test voice tries OpenAI again.
import { idToken } from "../lib/auth.ts";
import { config } from "../lib/config.ts";

export interface OpenAiStatus {
  configured: boolean;
  voices: string[];
  default: string;
  key_saved_at: string | null;
}

/** Closest to ChatGPT's Sol (the server's `default` wins when it answers). */
export const OPENAI_DEFAULT_VOICE = "marin";
const VOICE_KEY = "aic.openaiVoice";

let status: OpenAiStatus | null = null;
let loading: Promise<OpenAiStatus | null> | null = null;
let failed = false;
const listeners = new Set<(note: string) => void>();

/** The OpenAI voice's state, from the server (cached; `fresh` asks again). Null when it could not be read. */
export function loadOpenAi(fresh = false): Promise<OpenAiStatus | null> {
  if (fresh) loading = null;
  loading ??= (async () => {
    try {
      const token = await idToken();
      if (!token) return null;
      const r = await fetch(`${config().apiUrl}/voice/openai`, { headers: { authorization: `Bearer ${token}` } });
      status = r.ok ? ((await r.json()) as OpenAiStatus) : null;
    } catch {
      status = null; // no answer: Polly speaks, as before the key existed
    }
    return status;
  })();
  return loading;
}
export const openAiStatus = () => status;
/** OpenAI speaks the next sentence: the key is in and nothing failed this session. */
export const usingOpenAi = () => status?.configured === true && !failed;

export function readOpenAiVoice(): string {
  const voices = status?.voices ?? [OPENAI_DEFAULT_VOICE];
  let v: string | null = null;
  try {
    v = localStorage.getItem(VOICE_KEY);
  } catch {
    /* private mode: no memory */
  }
  return v && voices.includes(v) ? v : (status?.default ?? OPENAI_DEFAULT_VOICE);
}
export function saveOpenAiVoice(v: string) {
  try {
    localStorage.setItem(VOICE_KEY, v);
  } catch {
    /* private mode */
  }
}

/** One sentence through OpenAI. Throws an error named `OpenAiVoice` with the server's plain words. */
export async function openAiSynth(text: string): Promise<Blob> {
  const token = await idToken();
  if (!token) throw Object.assign(new Error("You were signed out."), { name: "SignedOut" });
  let r: Response;
  try {
    r = await fetch(`${config().apiUrl}/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), voice: readOpenAiVoice() }),
    });
  } catch {
    throw Object.assign(new Error("no connection to AI City"), { name: "OpenAiVoice", code: "unreachable" });
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
    if (j.error === "not_configured" && status) status = { ...status, configured: false };
    throw Object.assign(new Error(j.message || `the voice service answered ${r.status}`), {
      name: "OpenAiVoice",
      code: j.error ?? String(r.status),
    });
  }
  const clip = await r.blob();
  if (!clip.size) throw Object.assign(new Error("OpenAI returned no audio"), { name: "EmptyAudio" });
  return clip;
}

/** Hears about the switch to Polly (once per failure), for the voice line. */
export function onVoiceNote(fn: (note: string) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** The sentence player's synth: OpenAI while it works, else Polly (`polly`), switching once and saying so. */
export function withOpenAi<Clip>(polly: (text: string) => Promise<Clip | null>) {
  return async (text: string): Promise<Clip | Blob | null> => {
    if (!usingOpenAi()) return polly(text);
    try {
      return await openAiSynth(text);
    } catch (e) {
      if (!failed) {
        failed = true;
        const note = `OpenAI's voice failed (${(e as Error).message}). Using the Polly voice for now.`;
        for (const l of listeners) l(note);
      }
      return polly(text);
    }
  };
}

/** Try OpenAI again (a key was saved, or the voice test worked). */
export function resetOpenAi() {
  failed = false;
}
