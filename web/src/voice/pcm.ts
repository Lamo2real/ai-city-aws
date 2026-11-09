// Raw audio for VAIC's real-time voice (decision 120): the microphone goes out as 16 kHz 16-bit mono PCM,
// Nova Sonic's speech comes back as 24 kHz 16-bit mono PCM, both base64 in JSON frames.

/** Averages the microphone's samples down to 16 kHz and turns them into 16-bit integers. */
export function toPcm16k(input: Float32Array, rate: number): Int16Array {
  const ratio = rate / 16000;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to && j < input.length; j++) sum += input[j] ?? 0;
    const v = Math.max(-1, Math.min(1, sum / (to - from)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Sonic's base64 little-endian 16-bit samples as floats for Web Audio. */
export function base64ToFloats(b64: string): Float32Array<ArrayBuffer> {
  const s = atob(b64);
  const n = s.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8);
    out[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return out;
}
