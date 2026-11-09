"""Writes the app's tap sound (ios/AICity/Sounds/tap.wav): the same soft "tick" the web HUD makes with Web Audio
(web/src/lib/tapFx.ts): a sine dropping from 1.6 kHz to 700 Hz in 45 ms, rising in 4 ms and gone by 60 ms.

Made with Python's standard library only. Run from ios/: python3 -I scripts/make_tap_sound.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44100
SECONDS = 0.060
PEAK = 0.15  # quiet: it plays at the ringer's volume

out = Path("AICity/Sounds/tap.wav")
out.parent.mkdir(parents=True, exist_ok=True)
frames = bytearray()
phase = 0.0
n = int(RATE * SECONDS)
for i in range(n):
    t = i / RATE
    freq = 1600 * (700 / 1600) ** min(1.0, t / 0.045)  # exponential glide, then held
    phase += 2 * math.pi * freq / RATE
    if t < 0.004:
        gain = (t / 0.004) ** 2  # a quick, soft rise
    else:
        gain = 0.002 ** ((t - 0.004) / 0.056)  # exponential fall to silence at 60 ms
    frames += struct.pack("<h", int(32767 * PEAK * gain * math.sin(phase)))
with wave.open(str(out), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(bytes(frames))
print(f"wrote {out} ({out.stat().st_size} bytes)")
