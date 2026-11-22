// @ts-check
import * as THREE from 'three';
import { ROOM_END } from '../room-layout.js';
import { t } from '../i18n.js';

// The entrance wall closes the room opposite the window, with two doors:
// to the Key Archive (on the lab and workbench side) and to the painting
// archive (on the Atelier side). Both are placeholders for now: a zone panel says what is
// behind them. The overview camera stands outside this wall, so the wall is
// shown only while the camera is inside the room (a walk, or a flight to a
// door), like the cut-away front of a doll's house.

const WALL_Z = ROOM_END + .135;
const HALF_WIDTH = 8.7, HEIGHT = 13.8, THICKNESS = .27;
const DOOR = { width: 2.1, height: 3.55, arch: .55 };
export const ENTRANCE_DOORS = Object.freeze([
  Object.freeze({ id: 'paintingArchive', x: -4.6, label: t('АРХИВ КАРТИН') }),
  Object.freeze({ id: 'keyArchive', x: 4.6, label: t('АРХИВ КЛЮЧЕЙ') }),
]);
const FLOOR_Y = .0385;

/** A door outline with a shallow arch, in the wall's local x/y. */
function doorPath(shape, x) {
  const half = DOOR.width / 2, spring = FLOOR_Y + DOOR.height - DOOR.arch;
  shape.moveTo(x - half, FLOOR_Y);
  shape.lineTo(x + half, FLOOR_Y);
  shape.lineTo(x + half, spring);
  for (let i = 1; i <= 24; i++) {
    const angle = Math.PI * i / 24;
    shape.lineTo(x + half * Math.cos(angle), spring + DOOR.arch * Math.sin(angle));
  }
  shape.lineTo(x - half, FLOOR_Y);
  return shape;
}

function buildDoor(kit, group, { id, x, label }) {
  const { m, box, cylinder, label: plate, zoneTarget } = kit;
  const door = new THREE.Group();
  door.name = `entrance-door-${id}`;
  door.position.set(x, 0, 0);
  group.add(door);
  // The leaf, set a little into the opening, with two raised panels.
  const leafShape = doorPath(new THREE.Shape(), 0);
  const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(leafShape, { depth: .09, bevelEnabled: false, curveSegments: 24 }), m.darkWood);
  leaf.position.z = -.02;
  leaf.castShadow = leaf.receiveShadow = true;
  door.add(leaf);
  for (const y of [1.05, 2.55]) box(door, DOOR.width - .62, 1.05, .05, m.walnut, 0, y, -.04, .02);
  // Frame: jambs and an arch-shaped trim on the room side.
  const half = DOOR.width / 2;
  for (const side of [-1, 1]) box(door, .16, DOOR.height - DOOR.arch + .02, .34, m.roomTimber, side * (half + .06), FLOOR_Y + (DOOR.height - DOOR.arch) / 2, -.09);
  const archCurve = new THREE.EllipseCurve(0, FLOOR_Y + DOOR.height - DOOR.arch, half + .06, DOOR.arch + .06, 0, Math.PI);
  const archPoints = archCurve.getPoints(24).map(point => new THREE.Vector3(point.x, point.y, -.17));
  const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 32, .08, 6), m.roomTimber);
  door.add(arch);
  // A brass handle and keyhole plate.
  cylinder(door, .035, .035, .22, m.oldBrass, half - .32, 1.72, -.12, 10).rotation.x = Math.PI / 2;
  box(door, .1, .26, .02, m.oldBrass, half - .32, 1.5, -.08);
  // The painted sign above the door (the room side faces -z).
  // The wall's room-side face is at z = -.135; the sign hangs just in front.
  const sign = plate(door, label, 0, FLOOR_Y + DOOR.height + .42, -.16, 2.1, .36);
  sign.rotation.y = Math.PI;
  zoneTarget(id, [x, 1.9, WALL_Z - .45], [DOOR.width + .3, DOOR.height + .4, .6]);
  return door;
}

/** Builds the wall and its doors; update(camera) shows them only from inside. */
export function buildEntranceWall(kit) {
  const { m, staticGroup, box, hitTargets } = kit;
  const group = new THREE.Group();
  group.name = 'lair-entrance-wall';
  group.position.z = WALL_Z;
  staticGroup.add(group);

  const outline = new THREE.Shape();
  outline.moveTo(-HALF_WIDTH, -.14);
  outline.lineTo(HALF_WIDTH, -.14);
  outline.lineTo(HALF_WIDTH, HEIGHT - .14);
  outline.lineTo(-HALF_WIDTH, HEIGHT - .14);
  outline.closePath();
  for (const { x } of ENTRANCE_DOORS) outline.holes.push(doorPath(new THREE.Path(), x));
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: THICKNESS, bevelEnabled: false, curveSegments: 24 });
  // World-scale UVs on the face, like the window wall's plaster.
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const face = geometry.groups[0];
  for (let i = face.start; i < face.start + face.count; i++) {
    uv.setXY(i, (position.getX(i) + HALF_WIDTH) / 17.4, (position.getY(i) + .14) / 13.8);
  }
  uv.needsUpdate = true;
  const wall = new THREE.Mesh(geometry, m.plaster);
  wall.name = 'lair-entrance-wall-plaster';
  wall.position.z = -THICKNESS / 2;
  wall.receiveShadow = true;
  group.add(wall);
  // The same lower timber band as the other walls, broken by the doors.
  const edges = [-8.39, ...ENTRANCE_DOORS.flatMap(({ x }) => [x - DOOR.width / 2 - .14, x + DOOR.width / 2 + .14]), 8.39];
  for (let i = 0; i < edges.length; i += 2) {
    const from = edges[i], to = edges[i + 1];
    box(group, to - from, 1.47, .10, m.roomTimber, (from + to) / 2, .76, -THICKNESS / 2 - .05);
    box(group, to - from, .065, .16, m.roomTimber, (from + to) / 2, 1.5, -THICKNESS / 2 - .08);
  }

  const doors = ENTRANCE_DOORS.map(door => buildDoor(kit, group, door));
  const colliders = hitTargets.filter(target => ENTRANCE_DOORS.some(door => door.id === target.userData.zone));
  let shown = null;
  /** Show the wall (and let its doors be picked) only while the camera is inside the room. */
  function update(camera) {
    const inside = camera.position.z < WALL_Z - THICKNESS;
    if (inside === shown) return;
    shown = inside;
    group.visible = inside;
    for (const collider of colliders) collider.visible = inside;
  }
  return { group, doors, update };
}
