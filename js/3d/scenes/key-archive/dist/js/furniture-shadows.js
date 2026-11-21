// @ts-check
import { FIXTURE_OFFSETS } from './station-layout.js';

// Bake the broad shade and the darker contact at the feet into one image
// per surface. The same artwork is projected in both renderers.
function bakeShadow(width, depth, footprints) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 64);
  canvas.height = Math.ceil(depth * 64);
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(canvas.width / width, canvas.height / depth);
  for (const [x, z, radiusX, radiusZ, opacity] of footprints) {
    ctx.save();
    ctx.translate(x, z);
    ctx.scale(radiusX, radiusZ);
    const gradient = ctx.createRadialGradient(0, 0, .16, 0, 0, 1);
    gradient.addColorStop(0, `rgba(20,13,12,${opacity})`);
    gradient.addColorStop(.53, `rgba(25,16,14,${opacity * .72})`);
    gradient.addColorStop(1, 'rgba(25,16,14,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  return { width, depth, canvas };
}

function bakeFloorShadow(width, depth, footprints) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 64);
  canvas.height = Math.ceil(depth * 64);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const { data } = image;
  for (let row = 0; row < canvas.height; row++) {
    const z = (row + .5) * depth / canvas.height - depth / 2;
    for (let column = 0; column < canvas.width; column++) {
      const x = (column + .5) * width / canvas.width - width / 2;
      let alpha = 0;
      for (const [cx, cz, halfWidth, halfDepth, softness, opacity] of footprints) {
        // Distance to the edge of the furniture footprint. A small radius
        // softens the corners without turning the feet into circular spots.
        const radius = .025;
        const dx = Math.abs(x - cx) - halfWidth + radius;
        const dz = Math.abs(z - cz) - halfDepth + radius;
        const distance = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) +
          Math.min(Math.max(dx, dz), 0) - radius;
        const edge = Math.max(0, Math.min(1, (distance + softness * .35) / (softness * 1.35)));
        alpha += (1 - alpha) * opacity * (1 - edge * edge * (3 - 2 * edge));
      }
      const pixel = (row * canvas.width + column) * 4;
      data[pixel] = 20;
      data[pixel + 1] = 13;
      data[pixel + 2] = 12;
      data[pixel + 3] = 255 * alpha;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { width, depth, canvas };
}

function legShadows(x, front, back, halfSize) {
  return [-x, x].flatMap(side => [front, back].map(z => [side, z, halfSize, halfSize, .09, .53]));
}

export function createFurnitureShadows() {
  return {
    benchFloor: bakeFloorShadow(6.2, 2.6, [
      [.18, -.08, 2.46, .62, .29, .26],
      ...legShadows(2.29, -.47, .47, .08),
    ]),
    // The painted table has two trestles rather than four separate legs.
    paintedBenchFloor: bakeFloorShadow(6.2, 2.6, [
      [.18, -.08, 2.46, .62, .29, .26],
      ...[-1.71, 1.71].map(x => [x, 0, .085, .45, .09, .49]),
    ]),
    deskFloor: bakeFloorShadow(2.8, 3.35, [
      [.15, -.085, .845, 1.08, .31, .27],
      ...legShadows(.7, -.9, .9, .065),
    ]),
    fixtures: bakeShadow(5.0, 1.26, [
      // Each vessel gets a soft shade offset from the windows, then a tighter
      // band where its base meets the wood.
      [FIXTURE_OFFSETS.mud + .19, -.045, .73, .60, .58],
      [FIXTURE_OFFSETS.mud, .10, .55, .48, .78],
      [FIXTURE_OFFSETS.rust + .17, -.055, .71, .52, .57],
      [FIXTURE_OFFSETS.rust, .10, .64, .47, .79],
      [FIXTURE_OFFSETS.forge + .20, -.05, .76, .63, .60],
      [FIXTURE_OFFSETS.forge, .08, .63, .58, .78],
    ]),
  };
}
