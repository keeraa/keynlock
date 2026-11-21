// @ts-check
import * as THREE from 'three';
import { WORKBENCH_Z } from '../room-layout.js';

// The key workbench beside the laboratory, with its tool wall.
export function buildWorkbench(kit, wallX) {
  const { m, staticGroup, box, cylinder, sphere, rod, label, zoneTarget, makeTable, bottle } = kit;
  function toolPegboard() {
    // The tool wall belongs to the workbench along the right-hand tiled wall.
    const pegboard = new THREE.Group(); pegboard.position.set(wallX - .055, 1.98, WORKBENCH_Z);
    pegboard.rotation.y = -Math.PI / 2;
    pegboard.name = 'workbench-tool-wall';
    staticGroup.add(pegboard);
    box(pegboard, 2.3, 1.26, .12, m.agedWood);
    for (let x = -1; x <= 1; x += .22) for (let y = -.48; y <= .48; y += .22) {
      cylinder(pegboard, .012, .012, .03, m.darkWood, x, y, .075, 8).rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) {
      const x = -.76 + i * .38;
      rod(pegboard, [x, .30, .055], [x, .30, .16], .022, m.oldBrass, 8);
      rod(pegboard, [x, .30, .15], [x + (i % 2) * .07, -.33, .15], .018, m.iron);
      sphere(pegboard, .065, m.oldBrass, x + (i % 2) * .07, -.34, .15);
    }
    box(pegboard, 1.80, .29, .04, m.darkWood, 0, 1.32, -.045);
    label(pegboard, 'MECHANICA', 0, 1.32, -.024, 1.76, .26);
  }

  function makeKey(parent, x, surfaceY, z, size = .48) {
    const shape = new THREE.Shape();
    shape.moveTo(-.10, -.04); shape.lineTo(.28, -.04); shape.lineTo(.28, -.20); shape.lineTo(.36, -.20);
    shape.lineTo(.36, -.10); shape.lineTo(.45, -.10); shape.lineTo(.45, .05); shape.lineTo(-.10, .05);
    shape.absarc(-.20, 0, .15, -Math.PI / 4, Math.PI * 1.75, false);
    const hole = new THREE.Path(); hole.absarc(-.20, 0, .067, 0, Math.PI * 2, true); shape.holes.push(hole);
    const key = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelThickness: .008, bevelSize: .007, bevelSegments: 1 }), m.brass);
    key.rotation.set(-Math.PI / 2, 0, -.15);
    key.scale.setScalar(size / .48);
    key.geometry.computeBoundingBox();
    key.position.set(x, surfaceY - key.geometry.boundingBox.min.z * key.scale.y, z);
    key.castShadow = true;
    parent.add(key);
    return key;
  }

  toolPegboard();
  const benchHeight = .94;
  const bench = makeTable(staticGroup, 3.25, 1.32, 7.45, WORKBENCH_Z, benchHeight - .20);
  bench.name = 'workbench-right-of-alchemy';
  bench.rotation.y = -Math.PI / 2;
  const surfaceY = 1.20;
  const work = new THREE.Group();
  work.position.y = benchHeight - surfaceY;
  bench.add(work);
  box(work, 3.35, .12, 1.39, m.ash, 0, surfaceY - .06, 0, .03).name = 'workbench-tabletop';
  box(work, 1.5, .4, .09, m.darkWood, .4, .69, .59);
  for (const x of [-.45,.42]) box(work, .055, .32, .11, m.oldBrass, x, .70, .65);
  for (let i = 0; i < 2; i++) {
    box(work, .84, .21, .07, m.darkWood, -.68 + i * 1.11, .73, .626);
    cylinder(work, .044, .044, .032, m.brass, -.68 + i * 1.11, .73, .674, 12).rotation.x = Math.PI / 2;
  }
  // Vice with a brass workpiece clamped between steel jaws.
  box(work, .67, .28, .49, m.iron, -1.03, 1.31, -.29, .035);
  box(work, .12, .36, .61, m.blackMetal, -1.36, 1.47, -.30);
  box(work, .12, .36, .61, m.blackMetal, -.73, 1.47, -.30);
  rod(work, [-1.38, 1.30, -.30], [-.62, 1.30, -.30], .05, m.oldBrass);
  rod(work, [-1.48, 1.29, -.55], [-1.48, 1.29, -.03], .026, m.iron);
  box(work, .45, .08, .13, m.brass, -1.04, 1.53, -.24);
  makeKey(work, -.1, surfaceY, -.29, .75);
  makeKey(work, .33, surfaceY, -.12, .64);
  // Several files, a divider and a partly assembled lock.
  for (let i = 0; i < 3; i++) rod(work, [.24 + i * .14, 1.21, .27], [.46 + i * .14, 1.21, -.34], .021, i === 2 ? m.brass : m.iron);
  const lockY = surfaceY + Math.sin(Math.PI / 3) * .29 + .065;
  cylinder(work, .26, .26, .18, m.iron, 1.14, lockY, -.20, 24).rotation.z = Math.PI / 2;
  cylinder(work, .13, .13, .21, m.brass, 1.15, lockY + .03, -.20, 24).rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    box(work, .13, .13, .12, m.iron, 1.14 + Math.cos(a) * .29, lockY + Math.sin(a) * .29, -.20);
  }
  bottle(work, 1.40, surfaceY, .35, m.liquidAmber, .31, .13);
  zoneTarget('workbench', [7.17, 1.28, WORKBENCH_Z], [2.25, 2.5, 3.65]);
}
