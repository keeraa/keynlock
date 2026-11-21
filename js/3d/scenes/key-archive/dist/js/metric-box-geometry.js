// @ts-check
import * as THREE from '../vendor/three.js';

// BoxGeometry normally stretches one entire image across each face, whether
// that face is 20 metres wide or 10 centimetres wide. Scale each face's UVs
// by its actual dimensions so narrow pilasters and mouldings keep normal-sized
// brushwork instead of squashed, densely repeated strokes.
export function createMetricBoxGeometry(size, tileMeters = 2.6) {
  const [width, height, depth] = size.map(Math.abs);
  const geometry = new THREE.BoxGeometry(...size);
  const uv = geometry.getAttribute('uv');
  const faces = [
    [depth, height], [depth, height],
    [width, depth], [width, depth],
    [width, height], [width, height],
  ];
  for (let face = 0; face < 6; face++) {
    const [faceWidth, faceHeight] = faces[face];
    for (let vertex = 0; vertex < 4; vertex++) {
      const index = face * 4 + vertex;
      uv.setXY(index, uv.getX(index) * faceWidth / tileMeters,
        uv.getY(index) * faceHeight / tileMeters);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
