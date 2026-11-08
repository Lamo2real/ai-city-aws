import { describe, expect, it } from "vitest";
import { base64ToFloats, pcmToBase64, toPcm16k } from "../src/voice/pcm.ts";

describe("real-time voice audio (decision 120)", () => {
  it("averages 48 kHz down to 16 kHz 16-bit and clips loud samples", () => {
    const pcm = toPcm16k(new Float32Array([0.5, 0.5, 0.5, -2, -2, -2, 0, 0.3, 0.6]), 48000);
    expect([...pcm]).toEqual([Math.round(0.5 * 0x7fff - 0.5), -0x8000, Math.floor(0.3 * 0x7fff)]);
  });
  it("keeps 16 kHz as it is", () => {
    expect(toPcm16k(new Float32Array(160), 16000)).toHaveLength(160);
  });
  it("round-trips little-endian samples through base64", () => {
    const pcm = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const back = base64ToFloats(pcmToBase64(pcm));
    expect([...back]).toEqual([0, 0.5, -0.5, 32767 / 32768, -1]);
  });
});
