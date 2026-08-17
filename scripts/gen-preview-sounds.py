"""Render the two default (style A) cues to 16-bit WAV for README preview.

Matches lib/client.js: sine, 8ms linear attack, setTargetAtTime decay.
Not imported by the plugin — preview assets only.
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 44100

# kind, at_ms, freq, dur_ms, gain, decay_exp
NEEDS = [
    (0, 880.0, 130, 0.7, 7.0),
    (150, 1174.66, 130, 0.7, 7.0),
]
DONE = [
    (0, 523.25, 150, 0.6, 5.0),
    (110, 659.25, 150, 0.6, 5.0),
    (220, 783.99, 220, 0.65, 4.0),
]


def render(notes: list[tuple[float, float, float, float, float]]) -> list[float]:
    last_ms = max(at + dur + 350 for at, _f, dur, _g, _d in notes)
    n = int(SR * last_ms / 1000) + 1
    buf = [0.0] * n
    for at_ms, freq, dur_ms, gain, decay_exp in notes:
        t0 = int(SR * at_ms / 1000)
        dur = dur_ms / 1000.0
        tau = dur / decay_exp
        length = int(SR * (dur + 0.30))
        for i in range(length):
            t = i / SR
            if t < 0.008:
                env = gain * (t / 0.008)
            else:
                env = 0.0001 + (gain - 0.0001) * math.exp(-(t - 0.008) / tau)
            sample = env * math.sin(2 * math.pi * freq * t)
            idx = t0 + i
            if idx < n:
                buf[idx] += sample
    peak = max((abs(x) for x in buf), default=1.0) or 1.0
    scale = 0.89 / peak
    return [x * scale for x in buf]


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767))))
            for s in samples
        )
        w.writeframes(frames)


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "docs" / "sounds"
    write_wav(root / "needs.wav", render(NEEDS))
    write_wav(root / "done.wav", render(DONE))
    print(f"wrote {root / 'needs.wav'}")
    print(f"wrote {root / 'done.wav'}")


if __name__ == "__main__":
    main()
