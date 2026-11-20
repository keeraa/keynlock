import { FIXTURE_OFFSETS } from './station-layout.js?v=working-baths';

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

function legShadows(x, front, back) {
  return [-x, x].flatMap(side => [front, back].map(z => [side, z, .34, .31, .72]));
}

export function createFurnitureShadows() {
  return {
    benchFloor: bakeShadow(6.2, 2.95, [
      [0, 0, 3, 1.23, .42],
      [.21, -.19, 2.75, .99, .38],
      ...legShadows(2.29, -.63, .61),
    ]),
    deskFloor: bakeShadow(2.8, 3.35, [
      [.05, -.05, 1.22, 1.44, .50],
      [.17, -.15, 1.05, 1.34, .24],
      ...legShadows(.7, -.9, .9),
    ]),
    fixtures: bakeShadow(4.92, 1.48, [
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
