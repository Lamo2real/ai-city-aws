"""Writes the app's tap sound (ios/AICity/Sounds/tap.wav): the same soft glass "tink" the web HUD makes with Web
Audio (web/src/lib/tapFx.ts, TINK): two bell-like sine partials, 2.6 kHz and its inharmonic 2.76x overtone, rising in
2 ms and ringing out over 120 ms (the overtone over 50 ms). The owner asked for a different kind of click on
2026-11-09; this replaced the falling "tick".

Made with Python's standard library only. Run from ios/: python3 -I scripts/make_tap_sound.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44100
SECONDS = 0.130
LOUDNESS = 4.0  # the web's gains are quiet Web Audio levels; the system sound plays at the ringer's volume
PARTIALS = ((2600.0, 0.03, 0.12), (2600.0 * 2.76, 0.012, 0.05))  # (Hz, peak, seconds to fall to -80 dB)

out = Path("AICity/Sounds/tap.wav")
out.parent.mkdir(parents=True, exist_ok=True)
frames = bytearray()
for i in range(int(RATE * SECONDS)):
    t = i / RATE
    v = 0.0
    for hz, peak, decay in PARTIALS:
        if t < 0.002:
            g = peak * (t / 0.002) ** 2
        elif t < decay:
            g = peak * (0.0001 / peak) ** ((t - 0.002) / (decay - 0.002))
        else:
            g = 0.0
        v += g * math.sin(2 * math.pi * hz * t)
    frames += struct.pack("<h", max(-32767, min(32767, int(32767 * LOUDNESS * v))))
with wave.open(str(out), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(bytes(frames))
print(f"wrote {out} ({out.stat().st_size} bytes)")
