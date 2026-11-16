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
  });
}
