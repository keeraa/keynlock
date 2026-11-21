import * as THREE from 'three';
import { makeMapTexture } from '../materials.js';

// The planning table in the middle of the room.
export function buildPlanning(kit) {
  const { m, staticGroup, animated, box, cylinder, sphere, rod, plane, station, makeTable, bottle } = kit;
  function makePaper(parent, x, y, z, rotation = 0, size = [.53, .76]) {
    const sheet = box(parent, size[0], .013, size[1], m.paper, x, y, z);
    sheet.rotation.y = rotation;
    for (let i = 0; i < 6; i++) {
      const line = box(parent, size[0] * .64, .002, .005, m.paperDark, x, y + .009, z - size[1] * .31 + i * .07);
      line.rotation.y = rotation; line.castShadow = false;
    }
    return sheet;
  }

  function candle(parent, x, y, z) {
    cylinder(parent, .11, .11, .035, m.oldBrass, x, y, z);
    cylinder(parent, .061, .067, .35, m.paper, x, y + .195, z, 12);
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd391', transparent: true, opacity: .89, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.056, .18, 8), flameMat);
    flame.position.set(x, y + .48, z); parent.add(flame);
    animated.push(t => { flame.scale.set(.92 + Math.sin(t * 6) * .09, 1 + Math.sin(t * 9) * .15, .92); });
    const glow = new THREE.PointLight('#f8ad65', 2.2, 4.3, 2); glow.position.set(x, y + .53, z); parent.add(glow);
    return flame;
  }

  const table = makeTable(staticGroup, 2.95, 1.95, -.05, 1.44, 1.05);
  table.name = 'planning-main-table';
  table.scale.setScalar(1.3);
  box(table, 2.63, .06, 1.7, m.leather, 0, 1.18, 0, .03);
  makePaper(table, -.52, 1.222, .08, -.16, [.75, 1.04]);
  makePaper(table, .48, 1.233, -.29, .12, [.75, 1.07]);
  box(table, .43, .12, .5, m.darkWood, -.97, 1.27, -.43, .02);
  box(table, .48, .04, .56, m.paperDark, -.97, 1.35, -.43);
  candle(table, 1.12, 1.20, -.62);
  cylinder(table, .17, .17, .025, m.brass, .12, 1.26, .59, 28);
  rod(table, [.13, 1.30, .61], [.45, 1.30, .58], .012, m.iron);
  // Ink bottle and quill.
  bottle(table, -1.12, 1.47, .58, m.charcoal, .31, .09);
  rod(table, [-.95, 1.31, .44], [-.64, 1.48, .15], .014, m.paper);
  const chair = new THREE.Group(); chair.position.set(-.25, 0, 3.12); staticGroup.add(chair);
  chair.scale.setScalar(1.3);
  box(chair, .85, .14, .8, m.agedWood, 0, .58, 0, .04);
  for (const x of [-.3, .3]) for (const z of [-.25, .25]) rod(chair, [x, .05, z], [x, .58, z], .06, m.darkWood);
  box(chair, .85, .82, .14, m.agedWood, 0, 1.13, .32, .045);
  for (const y of [.83, 1.1, 1.36]) box(chair, .68, .04, .08, m.oldBrass, 0, y, .42);
  // The enlarged window leaves a narrow wall bay for the planning board.
  const board = new THREE.Group(); board.position.set(5.55, 3.37, -5.17); staticGroup.add(board);
  box(board, 2.27, 1.75, .10, m.darkWood);
  const map = makeMapTexture();
  plane(board, 2.05, 1.50, new THREE.MeshStandardMaterial({ map, roughness: 1 }), 0, 0, .072);
  for (const [x, y] of [[-.56,.42],[.48,-.25],[-.12,-.35]]) {
    sphere(board, .064, m.ruby, x, y, .12, 9);
    cylinder(board, .022, .027, .095, m.oldBrass, x, y, .12, 10).rotation.x = Math.PI / 2;
  }
  const shelf = box(staticGroup, 1.9, .12, .52, m.walnut, 5.45, 1.98, -4.96);
  shelf.castShadow = false;
  for (let i = 0; i < 5; i++) box(staticGroup, .15 + i * .022, .54 + (i % 2) * .16, .3, i % 2 ? m.ruby : m.leather, 4.71 + i * .24, 2.32 + (i % 2) * .08, -4.90);
  station('planning', [0, 1.42, 1.28], [3.4, 2.8, 2.6]);
}
