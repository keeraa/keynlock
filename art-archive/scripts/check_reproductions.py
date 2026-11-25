"""Check bundled preview/HD pairs before rebuilding the overview atlas (Pillow)."""
import json
from math import sqrt
from pathlib import Path
from PIL import Image

def signature(path):
    with Image.open(path) as source:
        ratio = source.width / source.height
        pixels = source.convert("L").resize((32, 32), Image.Resampling.LANCZOS).tobytes()
    mean = sum(pixels) / len(pixels)
    return ratio, mean, [p - mean for p in pixels]

def check(catalog, paintings):
    issues = []
    checked = 0
    for painting in paintings:
        image = painting["image"]
        path = image.get("detail", {}).get("path", "")
        if not path.startswith("detail/"):
            continue
        checked += 1
        a, brightness, x = signature(catalog / image["path"])
        b, detail_brightness, y = signature(catalog / path)
        scale = sqrt(sum(v*v for v in x) * sum(v*v for v in y))
        correlation = sum(i*j for i,j in zip(x,y)) / scale if scale else 1
        reasons = []
        if abs(brightness - detail_brightness) > 15:
            reasons.append(f"brightness difference {abs(brightness-detail_brightness):.1f}/255")
        if max(a/b,b/a) > 1.05 or correlation < .80:
            reasons.append(f"check crop (aspect {a:.2f}/{b:.2f}, correlation {correlation:.2f})")
        if reasons:
            issues.append(f"{painting['id']} — {', '.join(reasons)}")
    print(f"Compared {checked} local preview/HD pairs")
    return issues

if __name__ == "__main__":
    catalog = Path(__file__).resolve().parents[1] / "catalog"
    issues = check(catalog, json.loads((catalog / "manifest.json").read_text())["paintings"])
    if issues:
        raise SystemExit("\n".join(issues))
