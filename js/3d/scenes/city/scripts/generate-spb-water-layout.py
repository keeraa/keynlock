#!/usr/bin/env python3
"""Extract reproducible Neva/island geometry from a user-supplied plan image.

Example:
    python scripts/generate-spb-water-layout.py /path/to/map.png

The source artwork stays outside the website. Only the binary water geometry
and its small transparent raster mask are committed as game assets.
"""

from __future__ import annotations

import argparse
import base64
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JS = ROOT / "js/path-builder/spb-water-data.js"
OUTPUT_PNG = ROOT / "assets/map/spb-water-mask.png"
OUTPUT_SHORE = ROOT / "assets/map/spb-shore-wash.png"


def extract_water(image: Image.Image) -> np.ndarray:
    """Select the blue waterways, then remove isolated blue building details."""
    pixels = np.asarray(image.convert("RGB"), dtype=np.int16)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    water = (green - red > 9) & (blue - red > 10) & (red > 130) & (red < 225)

    # Bridge deck gaps, antialiased river borders, and compression speckles.
    disk = np.array([[False, True, False], [True, True, True], [False, True, False]])
    padded = np.pad(water, 3, mode="edge")
    water = ndi.binary_closing(padded, structure=disk, iterations=2)[3:-3, 3:-3]

    components, count = ndi.label(water)
    sizes = np.bincount(components.ravel())
    water &= (sizes[components] >= 115) & (components != 0)

    # Tiny holes inside open water are mostly bridge and paper artifacts.
    holes, count = ndi.label(~water)
    hole_sizes = np.bincount(holes.ravel())
    water |= (hole_sizes[holes] <= 42) & (holes != 0)
    return water


def encode_runs(water: np.ndarray) -> tuple[bytes, bytes, int]:
    height, width = water.shape
    starts = [0]
    runs = []
    for row in water:
        transitions = np.diff(np.pad(row.astype(np.int8), (1, 1)))
        entries = np.flatnonzero(transitions == 1)
        exits = np.flatnonzero(transitions == -1)
        runs.extend(v for pair in zip(entries, exits) for v in pair)
        starts.append(len(runs) // 2)
    if max(starts) > 65535 or width > 65535:
        raise ValueError("Water layout exceeds 16-bit row-run storage")
    return (struct.pack(f"<{len(starts)}H", *starts),
            struct.pack(f"<{len(runs)}H", *runs), len(runs) // 2)


def js_string(data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    return "\n".join(f"  '{encoded[i:i + 112]}' +" for i in range(0, len(encoded), 112))[:-2]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="User-provided top-down Saint Petersburg reference")
    args = parser.parse_args()
    with Image.open(args.image) as source:
        water = extract_water(source)
    height, width = water.shape
    offsets, pairs, run_count = encode_runs(water)
    # Signed-distance filtering rounds pixel stair steps without moving the
    # centreline of the reference shore. The alpha ramp is what WebGL blends:
    # binary source edges were visibly jagged on a zoomed 4.2-km map.
    signed_distance = (ndi.distance_transform_edt(water) -
                       ndi.distance_transform_edt(~water)).astype(np.float32)
    signed_distance = ndi.gaussian_filter(signed_distance, sigma=1.25, mode="nearest")
    coverage = np.clip((signed_distance + 1.35) / 2.7, 0, 1)
    coverage = coverage * coverage * (3 - 2 * coverage)
    rgba = np.empty((height, width, 4), dtype=np.uint8)
    rgba[:, :, :3] = 255
    rgba[:, :, 3] = np.rint(coverage * 255).astype(np.uint8)
    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(OUTPUT_PNG, optimize=True)
    distance_to_water = ndi.distance_transform_edt(~water)
    shoreline = np.empty((height, width, 4), dtype=np.uint8)
    shoreline[:, :, :3] = (196, 163, 118)
    shoreline[:, :, 3] = np.rint(
        np.clip(1 - distance_to_water / 9, 0, 1) ** 1.2 *
        np.clip((1.35 - signed_distance) / 2.7, 0, 1) * 78).astype(np.uint8)
    Image.fromarray(shoreline, "RGBA").save(OUTPUT_SHORE, optimize=True)
    OUTPUT_JS.write_text(
        "// Generated from the user-approved St Petersburg reference by\n"
        "// scripts/generate-spb-water-layout.py. Row-run data is little-endian u16.\n"
        f"export const WATER_MASK_WIDTH={width};\n"
        f"export const WATER_MASK_HEIGHT={height};\n"
        f"export const WATER_RUN_COUNT={run_count};\n"
        f"export const WATER_ROW_OFFSETS_BASE64=\n{js_string(offsets)};\n"
        f"export const WATER_RUN_PAIRS_BASE64=\n{js_string(pairs)};\n",
        encoding="utf-8",
    )
    print(f"Water geometry: {width}×{height}, {round(float(water.mean()) * 100, 2)}% water, "
          f"{run_count} shoreline runs, {OUTPUT_PNG.stat().st_size} bytes PNG, "
          f"{OUTPUT_SHORE.stat().st_size} bytes shoreline")


if __name__ == "__main__":
    main()
