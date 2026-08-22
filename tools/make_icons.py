"""Generate the app icons.

Writes PNGs with nothing but the standard library (zlib + struct), so this runs
on a bare Python install with no Pillow and no npm toolchain -- consistent with
the app itself, which has no build step and no dependencies.

    python tools/make_icons.py

PNGs are needed rather than just the SVG because iPadOS's "Add to Home Screen"
reads <link rel="apple-touch-icon">, which does not accept SVG. The icon is drawn
full-bleed (no rounded corners of its own): iOS applies its own mask, and the
manifest declares purpose "any maskable", which lets Android crop it safely too.

Rendered at 3x and box-downsampled for antialiasing -- cheap, and the star's
diagonal edges look ragged without it.
"""
from __future__ import annotations

import math
import struct
import sys
import zlib
from pathlib import Path

ICON_DIR = Path(__file__).resolve().parent.parent / "icons"
SS = 3  # supersampling factor

# Matches --yellow -> --pink in styles/main.css.
TOP = (0xFF, 0xD1, 0x66)
BOTTOM = (0xFF, 0x8F, 0xAB)
STAR = (0xFF, 0xFF, 0xFF)


def star_points(cx: float, cy: float, outer: float, inner: float, n: int = 5):
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + i * math.pi / n
        r = outer if i % 2 == 0 else inner
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def in_polygon(x: float, y: float, poly) -> bool:
    """Even-odd ray cast."""
    inside = False
    j = len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            if x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def render(size: int) -> list[bytes]:
    big = size * SS
    poly = star_points(big / 2, big * 0.52, big * 0.33, big * 0.135)

    # Render one supersampled row set, then average SS x SS blocks down.
    hi = []
    for y in range(big):
        t = y / (big - 1)
        bg = tuple(round(TOP[c] + (BOTTOM[c] - TOP[c]) * t) for c in range(3))
        row = bytearray()
        for x in range(big):
            row += bytes(STAR if in_polygon(x + 0.5, y + 0.5, poly) else bg)
        hi.append(bytes(row))

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            acc = [0, 0, 0]
            for dy in range(SS):
                src = hi[y * SS + dy]
                for dx in range(SS):
                    off = ((x * SS) + dx) * 3
                    acc[0] += src[off]
                    acc[1] += src[off + 1]
                    acc[2] += src[off + 2]
            n = SS * SS
            row += bytes(v // n for v in acc)
        rows.append(bytes(row))
    return rows


def write_png(path: Path, size: int, rows: list[bytes]) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    raw = b"".join(b"\x00" + r for r in rows)      # filter type 0 per scanline
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
    print(f"  {path.name}  {size}x{size}  {len(png) / 1024:.1f} KB")


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd166"/>
      <stop offset="1" stop-color="#ff8fab"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <polygon points="{pts}" fill="#ffffff"/>
</svg>
"""


def main() -> int:
    ICON_DIR.mkdir(exist_ok=True)
    print("Writing icons:")
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512),
                       ("apple-touch-icon.png", 180)]:
        write_png(ICON_DIR / name, size, render(size))

    pts = " ".join(f"{x:.1f},{y:.1f}"
                   for x, y in star_points(256, 266, 169, 69))
    (ICON_DIR / "icon.svg").write_text(SVG.format(pts=pts), encoding="utf-8")
    print("  icon.svg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
