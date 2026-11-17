// A real pierced shelf, with four through-holes for the test-tube necks.
// The geometry faces upward after a 90-degree rotation around the X axis.
export function makePerforatedRackShelf(THREE, width, depth, thickness, tubeXs, shelfZ = -.07, holeRadius = .29) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  shape.closePath();
  for (const x of tubeXs) {
    const opening = new THREE.Path();
    // Positive 2D Y becomes negative world Z after rotation. The holes must
    // still be centered at world Z=0 despite the shelf's -.07 position.
    opening.absarc(x, shelfZ, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(opening);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, steps: 1, bevelEnabled: false, curveSegments: 48
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}
