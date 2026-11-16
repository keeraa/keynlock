/** A machined U-shackle: equal straight legs and a mirrored half-circle. */
export function createSymmetricShackleCurve(THREE) {
  const endX = -.34;
  const bendX = .77;
  const radius = .64;
  const middleY = .64;
  const kappa = (Math.sqrt(2) - 1) * 4 / 3;
  const p = (x, y) => new THREE.Vector3(x, y, 0);
  const curve = new THREE.CurvePath();

  curve.add(new THREE.LineCurve3(p(endX, middleY + radius), p(bendX, middleY + radius)));
  curve.add(new THREE.CubicBezierCurve3(
    p(bendX, middleY + radius),
    p(bendX + kappa * radius, middleY + radius),
    p(bendX + radius, middleY + kappa * radius),
    p(bendX + radius, middleY),
  ));
  curve.add(new THREE.CubicBezierCurve3(
    p(bendX + radius, middleY),
    p(bendX + radius, middleY - kappa * radius),
    p(bendX + kappa * radius, middleY - radius),
    p(bendX, middleY - radius),
  ));
  curve.add(new THREE.LineCurve3(p(bendX, middleY - radius), p(endX, middleY - radius)));

  return curve;
}

// The 0.161-radius bore leaves 0.013 clearance around each full-size leg.
export const SHACKLE_RADIUS = .148;
const GROOVE_RADIUS = .107;

/** Keep the shackle a rigid round rod even when it tumbles in the Z-scaled case.
 * The case compresses depth to 70%. A regular rotation followed by a local Z
 * scale shears a tilted shackle, making the circular ends look like flared ovals.
 * Put the inverse depth scale *before* the rotation in the local matrix instead.
 */
export function createRigidShackleTransform(THREE, pivot) {
  const undoDepth = new THREE.Matrix4().makeScale(1, 1, pivot.scale.z);
  const rotation = new THREE.Matrix4();
  pivot.matrixAutoUpdate = false;
  const update = () => {
    pivot.matrix.makeTranslation(pivot.position.x, pivot.position.y, pivot.position.z)
      .multiply(undoDepth)
      .multiply(rotation.makeRotationFromQuaternion(pivot.quaternion));
    pivot.matrixWorldNeedsUpdate = true;
  };
  update();
  return update;
}

function smoothStep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The retaining-ball grooves are carved into one uninterrupted round bar. */
export function shackleProfileRadius(x) {
  const groove = smoothStep(-.25, -.215, x) * (1 - smoothStep(-.035, 0, x));
  return SHACKLE_RADIUS - (SHACKLE_RADIUS - GROOVE_RADIUS) * groove;
}

/** A single UV-mapped sweep eliminates the differently painted cylinder/tube joints. */
export function createRoundShackleGeometry(THREE, curve, segments = 256, radialSegments = 32) {
  const points = curve.getSpacedPoints(segments);
  const { normals, binormals } = curve.computeFrenetFrames(segments, false);
  const positions = [], vertexNormals = [], uv = [], indices = [];
  let distance = 0;
  const offset = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    if (i) distance += points[i].distanceTo(points[i - 1]);
    const center = points[i];
    const radius = shackleProfileRadius(center.x);
    const tangent = curve.getTangentAt(i / segments).normalize();
    const slope = (shackleProfileRadius(center.x + .001) -
      shackleProfileRadius(center.x - .001)) / .002 * tangent.x;
    for (let j = 0; j <= radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      offset.copy(normals[i]).multiplyScalar(Math.cos(angle))
        .addScaledVector(binormals[i], Math.sin(angle));
      const point = center.clone().addScaledVector(offset, radius);
      positions.push(point.x, point.y, point.z);
      const normal = offset.clone().addScaledVector(tangent, -slope).normalize();
      vertexNormals.push(normal.x, normal.y, normal.z);
      // Both edges of the wrap sample the same pigment: no visible axial seam.
      uv.push(.5 + .46 * Math.sin(angle), distance / 1.65);
    }
  }
  const stride = radialSegments + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j, b = (i + 1) * stride + j;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // The rod must be watertight: without flat machined ends its hollow-looking
  // openings reveal the black socket behind it when the camera moves around.
  // Duplicate the rim for the planar cap normals, preserving the smooth sweep.
  for (const i of [0, segments]) {
    const center = points[i];
    const radius = shackleProfileRadius(center.x);
    const outward = curve.getTangentAt(i / segments).normalize()
      .multiplyScalar(i === 0 ? -1 : 1);
    const capStart = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    vertexNormals.push(outward.x, outward.y, outward.z);
    uv.push(.5, .5);
    for (let j = 0; j <= radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      offset.copy(normals[i]).multiplyScalar(Math.cos(angle))
        .addScaledVector(binormals[i], Math.sin(angle));
      const point = center.clone().addScaledVector(offset, radius);
      positions.push(point.x, point.y, point.z);
      vertexNormals.push(outward.x, outward.y, outward.z);
      uv.push(.5 + .46 * Math.cos(angle), .5 + .46 * Math.sin(angle));
    }
    // The two legs point in opposite directions along the curve; choose each
    // fan's winding against its actual outward tangent to avoid backface gaps.
    const first = new THREE.Vector3().fromArray(positions, (capStart + 1) * 3)
      .sub(center);
    const second = new THREE.Vector3().fromArray(positions, (capStart + 2) * 3)
      .sub(center);
    const forward = first.cross(second).dot(outward) > 0;
    for (let j = 0; j < radialSegments; j++) {
      const a = capStart + 1 + j, b = a + 1;
      if (forward) indices.push(capStart, a, b);
      else indices.push(capStart, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertexNormals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  return geometry;
}
