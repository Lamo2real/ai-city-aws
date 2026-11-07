// The browser's own speech recognition, as a fallback when Amazon Transcribe refuses the stream (for example
// "NotAuthorizedException: Your account isn't authorized to call this operation", a 4xx, or no connection).
// Same listen() contract as Transcribe: final pieces to onText, live partials to onPartial, problems to onError.
// The switch lasts for this page session (sessionStorage); the next page load tries Transcribe again.
// Note: in Safari and Chrome the browser sends the audio to its own speech service (Apple's or Google's).

interface Alt {
  transcript: string;
}
interface Result {
  isFinal: boolean;
  0: Alt;
  length: number;
}
interface RecEvent {
  resultIndex: number;
  results: { length: number; [i: number]: Result };
}
interface Rec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecCtor = new () => Rec;

const KEY = "aic.speech.engine";

function ctor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const browserSpeechAvailable = (): boolean => ctor() !== null;

/** True once Transcribe was refused on this page session: go straight to the browser's recognition. */
export function usingBrowserSpeech(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "browser";
  } catch {
    return false;
  }
}
export function rememberBrowserSpeech() {
  try {
    sessionStorage.setItem(KEY, "browser");
  } catch {
    /* fine: we try Transcribe again next time */
  }
}

/** Whether a Transcribe failure should switch to the browser's recognition: the service refused or could not be
 *  reached. Not for microphone problems (permission, no device), which the browser's recognition would hit too. */
export function canFallBack(e: unknown): boolean {
  const err = e as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number; websocketSynthetic500Error?: boolean };
  };
  const name = err?.name ?? "";
  if (
    [
      "NotAllowedError",
      "SecurityError",
      "NotFoundError",
      "OverconstrainedError",
      "NotReadableError",
      "AbortError",
      "NoMicSupport",
      "SignedOut",
    ].includes(name)
  )
    return false;
  if (
    [
      "NotAuthorizedException",
      "AccessDeniedException",
      "UnrecognizedClientException",
      "ForbiddenException",
      "BadRequestException",
      "LimitExceededException",
      "ServiceUnavailableException",
      "InternalFailureException",
      "ResourceNotFoundException",
      "InvalidIdentityPoolConfigurationException",
      "CredentialsProviderError",
      "StreamEnded",
    ].includes(name)
  )
    return true;
  const status = err?.$metadata?.httpStatusCode;
  if (err?.$metadata?.websocketSynthetic500Error) return true; // the stream's connection never opened
  if (typeof status === "number" && status >= 400) return true;
  const msg = err?.message ?? "";
  // A page opened before a deploy cannot load the speech code: that needs a reload, not another engine.
  if (/Importing a module script failed|dynamically imported module|Loading chunk|ChunkLoadError/i.test(msg))
    return false;
  return name === "TypeError" && /load failed|failed to fetch|network/i.test(msg);
}

const named = (name: string, message: string) => Object.assign(new Error(message), { name });

/** Listens with the browser's recognition until the returned stop is called. */
export function browserListen(
  onText: (text: string) => void,
  onPartial?: (text: string) => void,
  onError?: (e: unknown) => void,
): () => void {
  const C = ctor();
  if (!C) throw named("NoBrowserSpeech", "This browser has no speech recognition");
  let stopped = false;
  let rec: Rec | null = null;
  const begin = () => {
    rec = new C();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const t = r[0]?.transcript?.trim() ?? "";
        if (!t) continue;
        if (r.isFinal) onText(t);
        else interim += (interim ? " " : "") + t;
      }
      if (interim) onPartial?.(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // silence: onend restarts it
      stopped = true;
      const map: Record<string, string> = {
        "not-allowed": "NotAllowedError",
        "service-not-allowed": "NotAllowedError",
        "audio-capture": "NotFoundError",
        network: "BrowserSpeechNetwork",
      };
      onError?.(
        named(
          map[e.error] ?? "BrowserSpeechError",
          `browser speech recognition: ${e.error}${e.message ? ` (${e.message})` : ""}`,
        ),
      );
    };
    // Browsers end recognition after a pause; keep listening until the owner taps stop.
    rec.onend = () => {
      if (!stopped) begin();
    };
    rec.start();
  };
  begin();
  return () => {
    stopped = true;
    try {
      rec?.stop();
    } catch {
      /* already stopped */
    }
  };
}
