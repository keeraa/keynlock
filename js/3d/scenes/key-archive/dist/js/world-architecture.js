import * as THREE from '../vendor/three.js';
import { makeLabel } from './art.js?v=key-ring';
import { HALL_SURFACE_TILE_METERS } from './hall-surface-textures.js?v=alchemy-candles';
import { createMetricBoxGeometry } from './metric-box-geometry.js?v=23';
import { WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y, HALL_HEIGHT_SCALE, HALL_END_WALL_HEIGHT,
  addArchedWindow, addWindowedWall, addVault } from './hall-architecture.js?v=window-sky';
import { ENTRANCE_DOOR_TEXTURE_URL } from './entrance-door-texture.js';
import { addArchiveLedger, ARCHIVE_DESK, ARCHIVE_SIDE_TABLES } from './archive-ledger.js?v=ledger-candle';

export function box(parent, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function roomBox(parent, size, position, material, tileMeters = HALL_SURFACE_TILE_METERS.trim) {
  const mesh = new THREE.Mesh(createMetricBoxGeometry(size, tileMeters), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

export function pilasterFreeTrimSpans() {
  // End every strip just before a pilaster. A continuous solid wainscot used
  // to penetrate the columns, causing flickering faces at the lower joins.
  const boundaries = [-23.4, ...PILASTER_CENTERS, 23.4];
  const spans = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index] + (index === 0 ? 0 : .321);
    const end = boundaries[index + 1] - (index === boundaries.length - 2 ? 0 : .321);
    if (end > start) spans.push([start, end]);
  }
  return spans;
}

function addTrimBetweenPilasters(scene, side, size, y, material) {
  for (const [start, end] of pilasterFreeTrimSpans()) {
    roomBox(scene, [size[0], size[1], end - start],
      [side * 11.93, y, (start + end) / 2], material);
  }
}

export function cylinder(parent, radius, height, position, material, sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

export function contactShadow(parent, width, depth, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.renderOrder = 1;
  parent.add(mesh);
}

function addEntranceDoor(scene, mat) {
  // Closed double door at the player's entrance (the far sealed gate remains intact).
  const z = 22.94;
  const handleY = 1.18;
  box(scene, [5.10, 7.10, .18], [0, 3.60, z + .11], mat.darkBrass);
  box(scene, [4.72, 6.72, .19], [0, 3.46, z - .035], mat.cabinetWalnut);
  const painting = new THREE.TextureLoader().load(ENTRANCE_DOOR_TEXTURE_URL);
  painting.colorSpace = THREE.SRGBColorSpace;
  painting.anisotropy = 4;
  const paintedLeaves = new THREE.Mesh(new THREE.PlaneGeometry(4.40, 6.44),
    new THREE.MeshStandardMaterial({ map: painting, roughness: .94, metalness: 0, side: THREE.DoubleSide }));
  paintedLeaves.rotation.y = Math.PI;
  paintedLeaves.position.set(0, 3.45, z - .275);
  scene.add(paintedLeaves);
  for (const side of [-1, 1]) {
    const x = side * 1.16;
    box(scene, [2.22, 6.48, .12], [x, 3.45, z - .19], mat.wood);
    box(scene, [.10, 6.48, .10], [x - side * 1.09, 3.45, z - .30], mat.darkBrass);
    box(scene, [.19, .61, .065], [side * .25, handleY + .09, z - .345], mat.agedBronze);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.13, .035, 8, 20), mat.brass);
    handle.position.set(side * .25, handleY, z - .41);
    scene.add(handle);
  }
  box(scene, [5.44, .32, .5], [0, 7.21, z - .02], mat.carvedWood);
  box(scene, [5.44, .18, .63], [0, .16, z - .04], mat.darkWood);
}

export function makeHall(scene, mat) {
  const shadowMaterial = mat.contactShadow;
  // The broad carpet makes the small metal objects legible from a standing view.
  const hallFloor = box(scene, [24, .28, 46.8], [0, -.19, 0], mat.floor);
  const carpet = box(scene, [16, .024, 37], [0, -.038, -.15], mat.hallCarpet);
  hallFloor.receiveShadow = true;
  carpet.receiveShadow = true;
  for (const x of [-7.92, 7.92]) box(scene, [.065, .016, 36.95], [x, -.018, -.15], mat.brass);
  for (const z of [-18.63, 18.33]) box(scene, [15.84, .016, .07], [0, -.018, z], mat.brass);

  // A gentle inlaid geometric pattern in the floor.
  const ringGeo = new THREE.RingGeometry(3.65, 3.69, 80);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9e7950, transparent: true, opacity: .35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.024;
  scene.add(ring);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const dash = box(scene, [.055, .014, .8], [Math.cos(angle) * 4.1, -.019, Math.sin(angle) * 4.1], mat.darkBrass);
    dash.rotation.y = -angle;
  }

  for (const side of [-1, 1]) {
    addWindowedWall(scene, side, mat.hallWall);
    addTrimBetweenPilasters(scene, side, [.55, 1.15], .53, mat.hallTrim);
    roomBox(scene, [.54, .29, 46.8], [side * 11.77, PERIMETER_BAND_Y, 0], mat.hallTrim);
    for (const z of PILASTER_CENTERS) {
      contactShadow(scene, 1.9, 1.65, side * 11.43, -.048, z, shadowMaterial);
      roomBox(scene, [.83, 11.0 * HALL_HEIGHT_SCALE, .63],
        [side * 11.76, 5.5 * HALL_HEIGHT_SCALE, z],
        mat.hallPilaster, 1);
      roomBox(scene, [1.14, .34, .91], [side * 11.73, PERIMETER_BAND_Y, z], mat.hallTrim);
      roomBox(scene, [1.1, .29, .88], [side * 11.73, 10.66 * HALL_HEIGHT_SCALE, z], mat.hallTrim);
      // Pilasters continue to the floor without the former brown base apron.
      roomBox(scene, [1.18, .18, 1.10], [side * 11.72, 10.83 * HALL_HEIGHT_SCALE, z], mat.hallTrim);
      roomBox(scene, [1.30, .10, 1.21], [side * 11.71, 10.98 * HALL_HEIGHT_SCALE, z], mat.agedBronze);
    }
    for (const z of WINDOW_CENTERS) addArchedWindow(scene, side, z, mat);
  }
  for (const z of [-23.39, 23.39]) {
    const endWall = box(scene, [24, HALL_END_WALL_HEIGHT, .42],
      [0, HALL_END_WALL_HEIGHT / 2, z], mat.hallEnd);
    endWall.castShadow = true;
    roomBox(scene, [24, 1.15, .6], [0, .53, z + (z < 0 ? .13 : -.13)], mat.hallTrim);
    roomBox(scene, [24, .29, .65], [0, PERIMETER_BAND_Y, z + (z < 0 ? .1 : -.1)], mat.hallTrim);
  }

  addEntranceDoor(scene, mat);

  addVault(scene, mat.hallVault, mat.hallBeam);

  // The sealed chapter door is half-size, including panels, lock and signage.
  const forgottenDoor = new THREE.Group();
  forgottenDoor.scale.set(.5, .5, 1);
  forgottenDoor.position.y = .05; // Keep its bottom planted on the floor.
  scene.add(forgottenDoor);
  box(forgottenDoor, [5.5, 7.15, .4], [0, 3.67, -23.04], mat.darkBrass);
  box(forgottenDoor, [4.67, 6.45, .43], [0, 3.39, -22.77], mat.blackWood);
  for (const x of [-1.6, -.8, 0, .8, 1.6])
    roomBox(forgottenDoor, [.11, 6.15, .48], [x, 3.35, -22.51], mat.darkWood);
  for (const y of [1.1, 3.9, 6.3]) box(forgottenDoor, [4.49, .12, .49], [0, y, -22.5], mat.brass);
  const keyholePlate = cylinder(forgottenDoor, .42, .075, [0, 5.25, -22.14], mat.brass, 24);
  keyholePlate.rotation.x = Math.PI / 2;
  const keyholeTop = new THREE.Mesh(new THREE.SphereGeometry(.145, 12, 8), mat.ink);
  keyholeTop.scale.z = .18;
  keyholeTop.position.set(0, 5.30, -22.08);
  forgottenDoor.add(keyholeTop);
  box(forgottenDoor, [.17, .38, .045], [0, 5.07, -22.07], mat.ink);
  const backLabel = makeLabel('ЗАЛ ЗАБЫТЫХ ДВЕРЕЙ', 'за архивом · закрыто', { worldWidth: 4.45, worldHeight: .95, fontSize: 64 });
  backLabel.position.set(0, 8.43, -22.85);
  forgottenDoor.add(backLabel);

  // A few side worktables add scale without blocking the sorting path.
  for (const { x, z } of ARCHIVE_SIDE_TABLES) {
    contactShadow(scene, 2.3, 2.75, x, -.046, z, shadowMaterial);
    box(scene, [ARCHIVE_DESK.width, .18, ARCHIVE_DESK.depth], [x, .83, z], mat.wood);
    for (const dx of [-.7, .7]) for (const dz of [-.9, .9])
      roomBox(scene, [.13, .8, .13], [x + dx, .35, z + dz], mat.darkWood);
    box(scene, [1.56, .05, 2.04], [x, ARCHIVE_DESK.y - .025, z], mat.darkBrass);
  }
  addArchiveLedger(scene, mat);
}

