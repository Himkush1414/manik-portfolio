"""Encode the rendered cover PNGs (render-covers.mjs) to AVIF + WebP for the /games page.

    python3 games/tools/covers/encode.py <pngDir> <outDir>

Per game: <slug>-land (1920x1200), <slug>-port (1080x1350) and <slug>-thumb (640x400, from land),
each as .avif and .webp. Needs Pillow >= 11 with AVIF support.
"""
import sys
from pathlib import Path
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for slug in ("mindtier", "space"):
    land = Image.open(src / f"{slug}-land.png").convert("RGB")
    port = Image.open(src / f"{slug}-port.png").convert("RGB")
    thumb = land.resize((640, 400), Image.LANCZOS)
    for name, im in (("land", land), ("port", port), ("thumb", thumb)):
        im.save(out / f"{slug}-{name}.avif", quality=58, speed=4)
        im.save(out / f"{slug}-{name}.webp", quality=80, method=6)
for f in sorted(out.iterdir()):
    print(f"{f.name:28s} {f.stat().st_size // 1024:5d} KB")
