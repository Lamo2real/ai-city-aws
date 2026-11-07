// The owner's voice choices, kept in localStorage:
//   speak mode — when AIC reads its reply aloud: "auto" (only when the owner's message came in by voice; the
//                default), "always" or "never".
//   mic mode   — what the mic does: "send" (talk, and what was said is sent when the owner stops talking) or
//                "dictate" (the words land in the message box to read, edit and send by hand).
// A dictated message counts as voice (so AIC answers aloud in "auto") only if the keyboard never touched the
// box since the last send; any typing, before or after dictating, makes it a typed message.
export type SpeakMode = "auto" | "always" | "never";
export type MicMode = "send" | "dictate";

const SPEAK_KEY = "aic.speak";
const OLD_SOUND_KEY = "aic.sound"; // before 2026-11-07: "on"/"off", replies spoken by default
const MIC_KEY = "aic.micMode";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* a preference only */
  }
};

export function readSpeakMode(): SpeakMode {
  const v = read(SPEAK_KEY);
  if (v === "auto" || v === "always" || v === "never") return v;
  return read(OLD_SOUND_KEY) === "off" ? "never" : "auto"; // a muted owner stays muted; everyone else gets the new default
}
export const saveSpeakMode = (m: SpeakMode) => write(SPEAK_KEY, m);
export const readMicMode = (): MicMode => (read(MIC_KEY) === "dictate" ? "dictate" : "send");
export const saveMicMode = (m: MicMode) => write(MIC_KEY, m);

/** Whether AIC should read this reply aloud, given the owner message it answers. */
export function shouldSpeak(mode: SpeakMode, askedByVoice: boolean | undefined): boolean {
  return mode === "always" || (mode === "auto" && askedByVoice === true);
}

/** Adds a piece of dictation to what is already in the box, with one space between. */
export function appendDictation(box: string, words: string): string {
  const w = words.trim();
  if (!w) return box;
  const b = box.replace(/\s+$/, "");
  return b ? `${b} ${w}` : w;
}

/** Polly generative English voices offered in Settings (all available in eu-central-1). */
export const VOICES = [
  { id: "Matthew", label: "Matthew (American, male)" },
  { id: "Stephen", label: "Stephen (American, male)" },
  { id: "Ruth", label: "Ruth (American, female)" },
  { id: "Danielle", label: "Danielle (American, female)" },
  { id: "Joanna", label: "Joanna (American, female)" },
  { id: "Brian", label: "Brian (British, male)" },
  { id: "Amy", label: "Amy (British, female)" },
] as const;
const VOICE_KEY = "aic.voice";

/** The voice chosen on this device, else the deploy's default, else Matthew. */
export function readVoiceId(fallback?: string): string {
  const v = read(VOICE_KEY);
  if (v && VOICES.some((x) => x.id === v)) return v;
  return fallback && VOICES.some((x) => x.id === fallback) ? fallback : "Matthew";
}
export const saveVoiceId = (id: string) => write(VOICE_KEY, id);
