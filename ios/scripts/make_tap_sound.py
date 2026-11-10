"""Writes the app's two tap sounds, the same ones the web HUD makes with Web Audio (web/src/lib/tapFx.ts):

- ios/AICity/Sounds/tap.wav, the "bloop" (BLOOP): a triangle wave gliding from 220 Hz up to 440 Hz over 120 ms, for
  every tap that works;
- ios/AICity/Sounds/refuse.wav, the kalimba (KALIMBA): an FM thumb-piano note at 784 Hz (modulator 3.5x, its
  brightness falling away) ringing for 450 ms, for a tap on something switched off and when something goes wrong.

The owner picked these two from twenty samples on 2026-11-10 (decision 187); they replaced the glass "tink".
Made with Python's standard library only. Run from ios/: python3 -I scripts/make_tap_sound.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44100
LOUDNESS = 2.5  # the web's gains are quiet Web Audio levels; the system sound plays at the ringer's volume


def envelope(t: float, peak: float, seconds: float) -> float:
    if t < 0.003:
        return peak * (t / 0.003) ** 2
    if t < seconds:
        return peak * (0.0001 / peak) ** ((t - 0.003) / (seconds - 0.003))
    return 0.0


def triangle(phase: float) -> float:
    x = phase % 1.0
    return 4 * x - 1 if x < 0.5 else 3 - 4 * x


def bloop() -> list[float]:
    seconds, peak, f0, f1 = 0.12, 0.12, 220.0, 440.0
    out, phase = [], 0.0
    for i in range(int(RATE * (seconds + 0.01))):
        t = i / RATE
        f = f0 * (f1 / f0) ** min(1.0, t / seconds)
        phase += f / RATE
        out.append(envelope(t, peak, seconds) * triangle(phase))
    return out


def kalimba() -> list[float]:
    seconds, peak, carrier, ratio, index = 0.45, 0.12, 784.0, 3.5, 1.2
    out = []
    for i in range(int(RATE * (seconds + 0.01))):
        t = i / RATE
        depth = carrier * index * (1 / (carrier * index)) ** min(1.0, t / seconds)  # falls to 1 Hz, as on the web
        mod = math.sin(2 * math.pi * carrier * ratio * t) * depth / (carrier * ratio)
        out.append(envelope(t, peak, seconds) * math.sin(2 * math.pi * carrier * t + 2 * math.pi * mod))
    return out


def write(name: str, samples: list[float]) -> None:
    out = Path("AICity/Sounds") / name
    out.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(32767 * LOUDNESS * v)))) for v in samples)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(frames)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


write("tap.wav", bloop())
write("refuse.wav", kalimba())
