import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createSymmetricShackleCurve, createRoundShackleGeometry,
  shackleProfileRadius, SHACKLE_RADIUS, createRigidShackleTransform } from '../src/js/geometry/shackle.js';

test('both full-size shackle legs approach the bore edge with safe clearance', () => {
  const boreRadius = .161;
  assert.ok(SHACKLE_RADIUS > .145, 'the round legs fill more of the original opening');
  assert.ok(boreRadius - SHACKLE_RADIUS >= .008,
    'the shackle must not rub or intersect the 0.161-radius bore');
  assert.ok(boreRadius - SHACKLE_RADIUS <= .015,
    'the gap is visually narrow on both sides');
  assert.ok(Math.abs(SHACKLE_RADIUS - shackleProfileRadius(-.31) - 0) < 1e-9);
});

test('shackle has equal, straight legs and a mirrored smooth semicircle', () => {
  const curve = createSymmetricShackleCurve(THREE);
  assert.equal(curve.curves.length, 4);
  const points = curve.getSpacedPoints(240);
  const tolerance = .002;
  for (let i = 0; i < points.length; i++) {
    const mirrored = points[points.length - 1 - i];
    assert.ok(Math.abs(points[i].x - mirrored.x) < tolerance, 'equal x on opposite sides');
    assert.ok(Math.abs(points[i].y + mirrored.y - 1.28) < tolerance,
      'opposite sides reflect across the midline');
    assert.ok(Math.abs(points[i].z) < tolerance);
  }
  assert.ok(curve.getPoint(0).distanceTo(new THREE.Vector3(-.34, 1.28, 0)) < tolerance);
  assert.ok(curve.getPoint(1).distanceTo(new THREE.Vector3(-.34, 0, 0)) < tolerance);
});

test('one-piece shackle has truly round cross-sections, inset grooves and continuous UVs', () => {
  const curve = createSymmetricShackleCurve(THREE);
  const segments = 256, radial = 32;
  const solid = createRoundShackleGeometry(THREE, curve, segments, radial);
  const position = solid.getAttribute('position');
  const normal = solid.getAttribute('normal');
  const textureUV = solid.getAttribute('uv');
  const indices = solid.getIndex();
  const centers = curve.getSpacedPoints(segments);
  const stride = radial + 1;
  const shellVertices = (segments + 1) * stride;
  assert.equal(position.count, shellVertices + 2 * (radial + 2));
  assert.equal(indices.count, segments * radial * 6 + radial * 6);
  for (let i = 0; i <= segments; i++) {
    const center = centers[i];
    const expectedRadius = shackleProfileRadius(center.x);
    for (let j of [0, 4, 8, 16, 24, 32]) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i * stride + j);
      assert.ok(Math.abs(point.distanceTo(center) - expectedRadius) < .00001,
        'the bar is a circular rod even around the bend and at the groove');
    }
    assert.ok(Math.abs(textureUV.getX(i * stride) - textureUV.getX(i * stride + radial)) < .00001,
      'both sides of the surface sample the same pigment at the UV seam');
    assert.ok(Math.abs(textureUV.getY(i * stride) - textureUV.getY(i * stride + radial)) < .00001);
  }
  assert.ok(shackleProfileRadius(-.14) < shackleProfileRadius(-.31) - .035,
    'retaining-ball grooves are cut into the solid bar');
  const initialRing = Array.from({ length: radial }, (_, j) =>
    new THREE.Vector3().fromBufferAttribute(position, j));
  const yRange = Math.max(...initialRing.map(p => p.y)) - Math.min(...initialRing.map(p => p.y));
  const zRange = Math.max(...initialRing.map(p => p.z)) - Math.min(...initialRing.map(p => p.z));
  assert.ok(Math.abs(yRange - zRange) < .00001,
    'both screen-world cross-section diameters are equal before perspective');
  const [a, b, c] = [indices.getX(0), indices.getX(1), indices.getX(2)];
  const vertex = index => new THREE.Vector3().fromBufferAttribute(position, index);
  const faceNormal = vertex(b).sub(vertex(a)).cross(vertex(c).sub(vertex(a))).normalize();
  assert.ok(faceNormal.dot(new THREE.Vector3().fromBufferAttribute(normal, a)) > .95,
    'outward-facing triangles are not culled by the renderer');
  for (const [end, sample] of [0, segments].entries()) {
    const capStart = shellVertices + end * (radial + 2);
    const capCenter = vertex(capStart);
    assert.ok(capCenter.distanceTo(centers[sample]) < 1e-7,
      'both machined ends contain a solid center, not an open tube');
    const outward = curve.getTangentAt(sample / segments).normalize()
      .multiplyScalar(end === 0 ? -1 : 1);
    assert.ok(new THREE.Vector3().fromBufferAttribute(normal, capStart).dot(outward) > .999);
    const firstCapFace = segments * radial * 6 + end * radial * 3;
    const capFace = [0, 1, 2].map(i => vertex(indices.getX(firstCapFace + i)));
    const front = capFace[1].sub(capFace[0]).cross(capFace[2].sub(capFace[0])).normalize();
    assert.ok(front.dot(outward) > .999,
      'flat shackle ends face outward and remain opaque under backface culling');
  }
  solid.dispose();
});

test('tilted or fallen shackle preserves its round bar and rigid U shape in the compressed casing', () => {
  const root = new THREE.Group();
  root.scale.z = .70;
  const pivot = new THREE.Group();
  pivot.position.set(1.52, -.64, .025);
  pivot.scale.z = 1 / .70;
  root.add(pivot);
  const curve = createSymmetricShackleCurve(THREE);
  const segments = 96, radial = 16;
  const geometry = createRoundShackleGeometry(THREE,curve,segments,radial);
  const mesh = new THREE.Mesh(geometry);
  pivot.add(mesh);
  const centers = curve.getSpacedPoints(segments), position = geometry.getAttribute('position');
  const updateRigidPose = createRigidShackleTransform(THREE,pivot);
  assert.equal(pivot.matrixAutoUpdate,false);

  for (const [rx,ry,rz] of [[0,0,0],[.85,.46,-.32],[1.22,-.73,.50],[-.35,1.41,.15]]) {
    pivot.quaternion.setFromEuler(new THREE.Euler(rx,ry,rz));
    pivot.position.y -= .12;
    updateRigidPose();
    root.updateMatrixWorld(true);
    for (const i of [0,13,36,58,83,96]) {
      const center = centers[i].clone().applyMatrix4(pivot.matrixWorld);
      for (const j of [0,4,8,12,16]) {
        const point = new THREE.Vector3().fromBufferAttribute(position,i*(radial+1)+j)
          .applyMatrix4(mesh.matrixWorld);
        assert.ok(Math.abs(center.distanceTo(point)-shackleProfileRadius(centers[i].x))<1e-5,
          'round cross-section must not flare or flatten after any 3D rotation');
      }
    }
    const ends = [centers[0],centers[segments]]
      .map(point => point.clone().applyMatrix4(pivot.matrixWorld));
    assert.ok(Math.abs(ends[0].distanceTo(ends[1])-1.28)<1e-5,
      'both shackle legs remain permanently joined to the same rigid U');
  }
  geometry.dispose();
});
