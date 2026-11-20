import * as THREE from '../vendor/three.js';
import { createMetricBoxGeometry } from './metric-box-geometry.js?v=23';

export const WINDOW_CENTERS = Object.freeze([-17, -8.5, 0, 8.5, 17]);
export const PILASTER_CENTERS = Object.freeze([-21.5, -12.75, -4.25, 4.25, 12.75, 21.5]);
export const WINDOW_SILL_Y = 5.86;
export const WINDOW_SPRING_Y = 9.17;
export const WINDOW_OPENING_RADIUS = 1.07;
export const WINDOW_CROWN_Y = WINDOW_SPRING_Y + WINDOW_OPENING_RADIUS;
export const WINDOW_SCALE = .8;
export const WINDOW_VERTICAL_SCALE = WINDOW_SCALE * .8;
export const WINDOW_RAISE_Y = .85;
export const WINDOW_CENTER_Y = (WINDOW_SILL_Y + WINDOW_CROWN_Y) / 2;
export const PERIMETER_BAND_Y = 5.2;
const SIDE_WALL_DEPTH = .44;
export const HALL_SIDE_WALL_INNER_X = 12.30 - SIDE_WALL_DEPTH;
export const HALL_HEIGHT_SCALE = 1.2;

export const windowY = y => WINDOW_CENTER_Y +
  (y - WINDOW_CENTER_Y) * WINDOW_VERTICAL_SCALE + WINDOW_RAISE_Y;

export function vaultHeight(x) {
  return (10.66 + .62 * (1 - (x / 12) ** 2)) * HALL_HEIGHT_SCALE;
}

// The end-wall boxes overlap the highest part of the vault at both ends.
export const HALL_END_WALL_HEIGHT = vaultHeight(0) + .08;

export function archedOpening(center = 0, radius = WINDOW_OPENING_RADIUS,
  sill = WINDOW_SILL_Y, spring = WINDOW_SPRING_Y, rise = radius) {
  const shape = new THREE.Shape();
  shape.moveTo(center - radius, sill);
  shape.lineTo(center + radius, sill);
  shape.lineTo(center + radius, spring);
  shape.absellipse(center, spring, radius, rise, 0, Math.PI, false, 0);
  shape.lineTo(center - radius, sill);
  shape.closePath();
  return shape;
}

// The openings are cut out of an actual wall, so directional sunlight can
// pass through their arched silhouettes when the wall casts shadows.
export function createWindowedWallGeometry() {
  const wall = new THREE.Shape();
  wall.moveTo(-23.4, -.02);
  wall.lineTo(23.4, -.02);
  wall.lineTo(23.4, 10.98 * HALL_HEIGHT_SCALE);
  wall.lineTo(-23.4, 10.98 * HALL_HEIGHT_SCALE);
  wall.closePath();
  for (const center of WINDOW_CENTERS) wall.holes.push(archedOpening(
    center, WINDOW_OPENING_RADIUS * WINDOW_SCALE,
    windowY(WINDOW_SILL_Y), windowY(WINDOW_SPRING_Y),
    WINDOW_OPENING_RADIUS * WINDOW_VERTICAL_SCALE));
  return new THREE.ExtrudeGeometry(wall, {
    depth: SIDE_WALL_DEPTH, bevelEnabled: false, curveSegments: 22, steps: 1,
  });
}

export function createWindowPaneGeometry() {
  const geometry = new THREE.ShapeGeometry(archedOpening(), 22);
  const uv = geometry.getAttribute('uv');
  const position = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (position.getX(i) + WINDOW_OPENING_RADIUS) / (2 * WINDOW_OPENING_RADIUS),
      (position.getY(i) - WINDOW_SILL_Y) / (WINDOW_CROWN_Y - WINDOW_SILL_Y));
  }
  uv.needsUpdate = true;
  return geometry;
}

const paneGeometry = createWindowPaneGeometry();

function smallBox(group, size, position, material, castsShadow = false) {
  const mesh = new THREE.Mesh(createMetricBoxGeometry(size), material);
  mesh.position.set(...position);
  mesh.castShadow = castsShadow;
  group.add(mesh);
  return mesh;
}

export function addArchedWindow(parent, side, z, mat) {
  const group = new THREE.Group();
  // Scale every pane/frame/muntin about the original window centre so the
  // visible arch remains exactly aligned with the smaller hole in the wall.
  group.position.set(side * 11.86,
    WINDOW_CENTER_Y * (1 - WINDOW_VERTICAL_SCALE) + WINDOW_RAISE_Y, z);
  group.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
  group.scale.set(WINDOW_SCALE, WINDOW_VERTICAL_SCALE, 1);
  parent.add(group);

  const glass = new THREE.Mesh(paneGeometry, mat.glass);
  glass.position.z = -.15;
  glass.renderOrder = -1;
  group.add(glass);
  const glow = new THREE.Mesh(paneGeometry, mat.windowLight);
  glow.position.z = -.015;
  group.add(glow);

  const frame = archedOpening(0, 1.19, 5.74);
  frame.holes.push(archedOpening());
  const surround = new THREE.Mesh(new THREE.ExtrudeGeometry(frame, {
    depth: .13, bevelEnabled: false, curveSegments: 22, steps: 1,
  }), mat.agedBronze);
  surround.position.z = -.055;
  surround.castShadow = true;
  group.add(surround);

  // All muntins meet the continuous arch surround; nothing ends mid-window.
  smallBox(group, [.105, 4.35, .11], [0, 8.04, .075], mat.cabinetWalnut, true);
  for (const y of [7.43, 8.64])
    smallBox(group, [2.25, .095, .11], [0, y, .075], mat.cabinetWalnut, true);
  smallBox(group, [2.5, .16, .21], [0, 5.73, .025], mat.agedBronze, true);
  return group;
}

export function addWindowedWall(parent, side, material) {
  const wall = new THREE.Mesh(createWindowedWallGeometry(), material);
  // The extruded front cap sits exactly on the inside surface, x=±11.86.
  wall.position.x = side * (HALL_SIDE_WALL_INNER_X + SIDE_WALL_DEPTH);
  wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
  wall.castShadow = true;
  parent.add(wall);
  return wall;
}

export function createVaultGeometry() {
  const horizontal = 32;
  const longitudinal = 40;
  const positions = [];
  const uvs = [];
  const triangles = [];
  for (let ix = 0; ix <= horizontal; ix++) {
    const x = -12 + ix * 24 / horizontal;
    for (let iz = 0; iz <= longitudinal; iz++) {
      const z = -23.4 + iz * 46.8 / longitudinal;
      positions.push(x, vaultHeight(x), z);
      uvs.push(ix / horizontal, iz / longitudinal);
    }
  }
  for (let ix = 0; ix < horizontal; ix++) for (let iz = 0; iz < longitudinal; iz++) {
    const a = ix * (longitudinal + 1) + iz;
    const b = a + longitudinal + 1;
    triangles.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

export function addVault(parent, ceilingMaterial, beamMaterial) {
  const material = ceilingMaterial.clone();
  material.side = THREE.DoubleSide;
  const ceiling = new THREE.Mesh(createVaultGeometry(), material);
  ceiling.castShadow = true;
  parent.add(ceiling);
  // One solid surface, with ribs partially embedded in it and meeting the
  // pilasters between windows instead of crossing the window apertures.
  for (const z of PILASTER_CENTERS) {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => {
      const x = -11.82 + i * 23.64 / 24;
      return new THREE.Vector3(x, vaultHeight(x) - .035, z);
    }));
    parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .19, 8, false), beamMaterial));
  }
  return ceiling;
}
