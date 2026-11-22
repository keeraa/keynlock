// @ts-check
/**
 * The wood grain runs along each side of the frame, as in a real one: along
 * the top and bottom rails, up the stiles. The texture's grain runs along v,
 * so the rails (and every edge face) get their u and v swapped.
 */
function frameGrainUVs(THREE, outerW, outerH) {
  // Three.js's world-space UVs (ExtrudeGeometry's default generator), turned
  // a quarter where the grain must run along x.
  const point = (vertices, index) => [vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]];
  return {
    generateTopUV(geometry, vertices, a, b, c) {
      const corners = [a, b, c].map(index => point(vertices, index));
      const x = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
      const y = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
      // Closer to the top or bottom edge than to a side: a rail.
      const rail = outerH / 2 - Math.abs(y) < outerW / 2 - Math.abs(x);
      return corners.map(([px, py]) => rail ? new THREE.Vector2(py, px) : new THREE.Vector2(px, py));
    },
    generateSideWallUV(geometry, vertices, a, b, c, d) {
      const corners = [a, b, c, d].map(index => point(vertices, index));
      const alongX = Math.abs(corners[0][1] - corners[1][1]) < Math.abs(corners[0][0] - corners[1][0]);
      // Grain along the edge (u is the depth).
      return corners.map(([px, py, pz]) => new THREE.Vector2(1 - pz, alongX ? px : py));
    },
  };
}

/** One continuous wooden profile, without overlapping rails or decorative lips. */
export function createFrameGeometry(THREE, width, height, rim = .135, depth = .095) {
  const outerW = width + rim * 2;
  const outerH = height + rim * 2;

  const outline = new THREE.Shape();
  outline.moveTo(-outerW / 2, -outerH / 2);
  outline.lineTo(outerW / 2, -outerH / 2);
  outline.lineTo(outerW / 2, outerH / 2);
  outline.lineTo(-outerW / 2, outerH / 2);
  outline.closePath();

  // Reverse winding for the empty painting aperture.
  const aperture = new THREE.Path();
  aperture.moveTo(-width / 2, -height / 2);
  aperture.lineTo(-width / 2, height / 2);
  aperture.lineTo(width / 2, height / 2);
  aperture.lineTo(width / 2, -height / 2);
  aperture.closePath();
  outline.holes.push(aperture);

  return new THREE.ExtrudeGeometry(outline, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1,
    UVGenerator: frameGrainUVs(THREE, outerW, outerH),
  });
}
