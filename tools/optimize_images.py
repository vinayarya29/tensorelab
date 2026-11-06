"""Make web-optimised WebP copies of the site's images and write images/manifest.json.

For every source image (JPEG/PNG) it writes `<name>.<width>.webp` at the widths the pages
actually display (and 2x for high-resolution screens), never upscaling. The originals stay as
the fallback `src`. tools/build.py reads the manifest to emit `srcset`, `width` and `height`.

Run after adding or replacing images (needs Pillow):
    python3 tools/optimize_images.py && python3 tools/build.py
"""
import json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "images"
# (glob, widths, webp quality). Text-heavy slides/infographics get a higher quality.
RULES = [
    ("highlights/slide??.jpg", (800, 1200, 1600), 84),
    ("highlights/htw??.jpg", (800, 1200, 1600), 84),
    ("themes/*.jpg", (420, 840), 84),
    ("lab/*.jpg", (600, 1000), 82),
    ("people/*.jpg", (160, 320), 84),
    ("research-platform.jpg", (1000, 1672), 88),
    ("tensore-logo.png", (128, 256), 90),
]


def main():
    manifest = {}
    for pattern, widths, q in RULES:
        for src in sorted(IMG.glob(pattern)):
            im = Image.open(src)
            im.load()
            mode = "RGBA" if im.mode in ("RGBA", "LA", "P") and "transparency" in im.info or im.mode == "RGBA" else "RGB"
            im = im.convert(mode)
            done = []
            for w in widths:
                w = min(w, im.width)
                if w in done:
                    continue
                out = src.with_name(f"{src.stem}.{w}.webp")
                h = round(im.height * w / im.width)
                (im if w == im.width else im.resize((w, h), Image.LANCZOS)).save(out, "WEBP", quality=q, method=6)
                done.append(w)
            rel = src.relative_to(ROOT).as_posix()
            manifest[rel] = {"w": im.width, "h": im.height, "webp": done}
            before = src.stat().st_size // 1024
            after = src.with_name(f"{src.stem}.{done[0]}.webp").stat().st_size // 1024
            print(f"{rel:42s} {before:5d} KB  ->  {done[0]}w webp {after:4d} KB  ({', '.join(map(str, done))})")
    (IMG / "manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
    print(f"{len(manifest)} images in images/manifest.json")


if __name__ == "__main__":
    main()
