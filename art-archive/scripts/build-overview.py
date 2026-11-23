"""Rebuild the distant-view texture after changing the catalog's source images (Pillow)."""
import json
from math import ceil
from pathlib import Path
from PIL import Image
from check_reproductions import check

catalog = Path(__file__).resolve().parents[1] / "catalog"
manifest = catalog / "manifest.json"
data = json.loads(manifest.read_text())
issues = check(catalog, data["paintings"])
if issues:
    raise SystemExit("\n".join(issues))
cell = 64
columns = 36
rows = ceil((len(data["paintings"]) + 1) / columns)
atlas = Image.new("RGB", (columns * cell, rows * cell), "#594335")
# Cell zero is the frame color. Duplicate edge pixels into each thumbnail's gutter.
for index, painting in enumerate(data["paintings"], 1):
    image = painting["image"]
    with Image.open(catalog / image["path"]) as source:
        tile = source.convert("RGB").resize((cell-4, cell-4), Image.Resampling.LANCZOS)
    x = index % columns * cell
    y = index // columns * cell
    atlas.paste(tile.resize((cell,cell)), (x,y))
    atlas.paste(tile, (x+2,y+2))
    image["overviewCell"] = index

atlas.save(catalog / "overview.webp", quality=86, method=5)
data["overviewAtlas"] = {"path":"overview.webp","columns":columns,"rows":rows,"cellSize":cell,"gutter":2}
manifest.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n")
