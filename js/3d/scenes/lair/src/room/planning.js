// @ts-check
import * as THREE from 'three';
import { makeMapTexture } from './materials.js';
import { WINDOW_OPENING } from './window.js';

// The planning table in the middle of the room.
export function buildPlanning(kit) {
  const { m, staticGroup, animated, box, cylinder, sphere, rod, plane, zoneTarget, makeTable, bottle } = kit;
  function makePaper(parent, x, y, z, rotation = 0, size = [.53, .76]) {
    const sheet = new THREE.Group();
    sheet.position.set(x, y, z);
    sheet.rotation.y = rotation;
    parent.add(sheet);
    box(sheet, size[0], .013, size[1], m.paper, 0, .0065, 0);
    for (let i = 0; i < 6; i++) {
      // Ruled lines are drawn flat on the sheet: tiny raised strips came out
      // as dashes in the ink outline.
      const line = plane(sheet, size[0] * .64, .006, m.paperDark, 0, .0134, -size[1] * .31 + i * .07);
      line.rotation.x = -Math.PI / 2;
    }
    return sheet;
  }

  function candle(parent, x, y, z) {
    cylinder(parent, .11, .11, .035, m.oldBrass, x, y + .0175, z);
    cylinder(parent, .061, .067, .35, m.paper, x, y + .21, z, 12);
    cylinder(parent, .009, .011, .04, m.charcoal, x, y + .399, z, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd391', transparent: true, opacity: .89, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.056, .18, 8), flameMat);
    flame.position.set(x, y + .487, z); parent.add(flame);
    animated.push(t => { flame.scale.set(.92 + Math.sin(t * 6) * .09, 1 + Math.sin(t * 9) * .15, .92); });
    const glow = new THREE.PointLight('#f8ad65', 2.2, 4.3, 2); glow.position.set(x, y + .53, z); parent.add(glow);
    return flame;
  }

  const rugTop = .0505;
  const deskSurfaceY = .86;
  const matThickness = .06;
  const table = makeTable(staticGroup, 2.95, 1.95, -.05, 1.44, deskSurfaceY - .10, rugTop);
  table.name = 'planning-main-table';
  const matTop = deskSurfaceY + matThickness;
  box(table, 2.63, matThickness, 1.7, m.leather, 0, deskSurfaceY + matThickness / 2, 0, .03)
    .name = 'planning-desk-mat';
  makePaper(table, -.52, matTop, .08, -.16, [.75, 1.04]);
  makePaper(table, .48, matTop, -.29, .12, [.75, 1.07]);
  box(table, .43, .12, .5, m.darkWood, -.97, matTop + .06, -.43, .02);
  box(table, .48, .04, .56, m.paperDark, -.97, matTop + .14, -.43);
  candle(table, 1.12, matTop, -.62);
  cylinder(table, .17, .17, .025, m.brass, .12, matTop + .0125, .59, 28);
  rod(table, [.13, matTop + .035, .61], [.45, matTop + .01, .58], .012, m.iron);
  // Ink bottle and quill.
  bottle(table, -1.12, matTop, .58, m.charcoal, .31, .09);
  rod(table, [-.95, matTop + .013, .44], [-.64, matTop + .013, .15], .014, m.paper);
  const chair = new THREE.Group(); chair.position.set(-.25, 0, 3.12); staticGroup.add(chair);
  chair.name = 'planning-chair';
  const seatY = .515;
  box(chair, .65, .09, .63, m.agedWood, 0, seatY, 0, .035).name = 'planning-chair-seat';
  for (const x of [-.24, .24]) for (const z of [-.25, .25]) {
    const support = z < 0 ? rugTop : .0385;
    rod(chair, [x, support, z], [x, seatY, z], .045, m.darkWood).name = 'planning-chair-leg';
  }
  box(chair, .65, .61, .12, m.agedWood, 0, seatY + .295, .28, .035);
  for (const height of [.165, .335, .505]) box(chair, .52, .04, .06, m.oldBrass, 0, seatY + height, .34);
  // The enlarged window leaves a narrow wall bay for the planning board.
  const wallZ = WINDOW_OPENING.wallZ;
  const board = new THREE.Group(); board.position.set(5.55, 3.37, wallZ + .045); staticGroup.add(board);
  board.name = 'planning-wall-board';
  box(board, 2.27, 1.75, .10, m.darkWood);
  const map = makeMapTexture();
  const mapPaper = box(board, 2.05, 1.50, .012, new THREE.MeshStandardMaterial({ map, roughness: 1 }), 0, 0, .055);
  mapPaper.castShadow = mapPaper.receiveShadow = false;
  for (const [x, y] of [[-.56,.42],[.48,-.25],[-.12,-.35]]) {
    sphere(board, .064, m.ruby, x, y, .12, 9);
    cylinder(board, .022, .027, .095, m.oldBrass, x, y, .09, 10).rotation.x = Math.PI / 2;
  }
  const shelfZ = wallZ + .25;
  const shelf = box(staticGroup, 1.9, .12, .52, m.walnut, 5.45, 1.98, shelfZ);
  shelf.name = 'planning-wall-shelf';
  shelf.castShadow = false;
  for (let i = 0; i < 5; i++) {
    const height = .54 + (i % 2) * .16;
    box(staticGroup, .15 + i * .022, height, .3, i % 2 ? m.ruby : m.leather,
      4.71 + i * .24, 2.04 + height / 2, shelfZ + .06).name = 'planning-shelf-book';
  }
  zoneTarget('planning', [0, 1.15, 1.28], [3.4, 2.3, 2.6]);
  return [table, chair];
}
