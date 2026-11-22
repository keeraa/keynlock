// @ts-check
import * as THREE from 'three';
import { canvasTexture } from './materials.js';
import { WINDOW_CUTOUT } from './window.js';
import { CEILING_BEAM_Z, ROOM_CENTER_Z, ROOM_END, ROOM_LENGTH, ROOM_START } from '../room-layout.js';

// The long room itself: floor, walls, ceiling, rug and the right-wall finish.
export function buildShell(kit) {
  const { m, scene, staticGroup, box, plane } = kit;
  scene.background = new THREE.Color('#2f3834');
  scene.fog = new THREE.Fog('#514d40', 39, 94);
  const ceilingBottom = 13.52;
  const floorBase = box(staticGroup, 17.3, .22, ROOM_LENGTH, m.darkWood, 0, -.14, ROOM_CENTER_Z);
  floorBase.name = 'lair-floor-base';
  floorBase.castShadow = false;
  const plankStep = .325;
  const plankCount = Math.ceil(ROOM_LENGTH / plankStep);
  for (let i = 0; i < plankCount; i++) {
    const start = ROOM_START + i * plankStep;
    const span = Math.min(plankStep, ROOM_END - start);
    const z = start + span / 2;
    // Boards butt together: a gap would show the boards' side faces, which
    // the ink outline drew as dotted lines along every seam.
    const plank = box(staticGroup, 17.1, .047, span, i % 6 === 0 ? m.floorAlternate : m.floor, 0, .015, z);
    plank.castShadow = false;
    // Give adjoining boards different parts of the same painted grain.
    const uv = plank.geometry.getAttribute('uv');
    const grainX = (i % 7) * .23;
    const grainY = (i % 11) * .57;
    for (let j = 0; j < uv.count; j++) {
      uv.setXY(j, uv.getX(j) + grainX, uv.getY(j) + grainY);
    }
    if (i % 5 === 0) {
      // A painted seam, flat on the boards (no edges for the outline).
      const seam = plane(staticGroup, 17.1, .012, m.darkWood, 0, .0392, start + .006);
      seam.rotation.x = -Math.PI / 2;
    }
  }
  // Double-height room, measured from the same floor datum as the original.
  // The arched opening runs all the way through the plaster. A solid box
  // would occlude any exterior scenery and leave the glass looking painted on.
  const backOutline = new THREE.Shape();
  backOutline.moveTo(-8.7, -.14);
  backOutline.lineTo(8.7, -.14);
  backOutline.lineTo(8.7, 13.66);
  backOutline.lineTo(-8.7, 13.66);
  backOutline.closePath();
  const opening = new THREE.Path();
  const { centerX: openingX, halfWidth: openingHalf, bottom: openingBottom,
    spring: openingSpring, rise: openingRise } = WINDOW_CUTOUT;
  opening.moveTo(openingX - openingHalf, openingBottom);
  opening.lineTo(openingX - openingHalf, openingSpring);
  for (let i = 1; i <= 64; i++) {
    const angle = Math.PI - Math.PI * i / 64;
    opening.lineTo(openingX + openingHalf * Math.cos(angle), openingSpring + openingRise * Math.sin(angle));
  }
  opening.lineTo(openingX + openingHalf, openingBottom);
  opening.closePath();
  backOutline.holes.push(opening);
  const wallGeometry = new THREE.ExtrudeGeometry(backOutline, { depth: .27, bevelEnabled: false, curveSegments: 64 });
  // ExtrudeGeometry uses world-unit cap UVs; normalize so the gouache scale
  // still matches the original single-piece plaster wall.
  const wallPosition = wallGeometry.getAttribute('position');
  const wallUV = wallGeometry.getAttribute('uv');
  const cap = wallGeometry.groups[0];
  for (let i = cap.start; i < cap.start + cap.count; i++) {
    wallUV.setXY(i, (wallPosition.getX(i) + 8.7) / 17.4, (wallPosition.getY(i) + .14) / 13.8);
  }
  wallUV.needsUpdate = true;
  const backWall = new THREE.Mesh(wallGeometry, m.plaster);
  backWall.name = 'back-wall-arched-cutout';
  backWall.position.z = -5.755;
  backWall.receiveShadow = true;
  staticGroup.add(backWall);
  // Preserve the original uninterrupted painted walls. The existing
  // workstations are reached by a camera focus, without new architecture.
  box(staticGroup, .27, 13.8, ROOM_LENGTH, m.plaster, -8.55, 6.76, ROOM_CENTER_Z).castShadow = false;
  box(staticGroup, .27, 13.8, ROOM_LENGTH, m.plaster, 8.55, 6.76, ROOM_CENTER_Z).castShadow = false;
  box(staticGroup, 17.5, .20, ROOM_LENGTH, m.ceiling, 0, ceilingBottom + .10, ROOM_CENTER_Z)
    .name = 'lair-ceiling';
  const leftFinish = plane(staticGroup, ROOM_LENGTH - .12, 13.55, m.galleryPlaster, -8.391, 6.72, ROOM_CENTER_Z);
  // Keep the brushwork at the same physical scale along the gallery wall.
  const galleryUV = leftFinish.geometry.getAttribute('uv');
  for (let i = 0; i < galleryUV.count; i++) {
    galleryUV.setX(i, galleryUV.getX(i) * leftFinish.geometry.parameters.width / 17.4);
  }
  leftFinish.rotation.y = Math.PI / 2;
  leftFinish.name = 'atelier-side-wall';
  // One continuous sage-green tiled finish covers the entire right wall.
  // It sits just in front of the plaster, from the floor to the ceiling.
  const rightFinish = plane(staticGroup, ROOM_LENGTH - .08, 13.54, m.alchemyTile, 8.392, 6.77, ROOM_CENTER_Z);
  rightFinish.rotation.y = -Math.PI / 2;
  rightFinish.castShadow = false;
  rightFinish.name = 'alchemy-right-wall';

  // Match the height and profile of the lower timber finish on all three walls.
  const wainscot = new THREE.Group();
  wainscot.name = 'lair-wainscot';
  staticGroup.add(wainscot);
  const innerHalf = 8.39, insideBack = -5.48;
  const timber = m.roomTimber;
  const leftJamb = openingX - openingHalf;
  const rightJamb = openingX + openingHalf;
  const capHeight = .065;
  for (const { part, height, y, depth } of [
    { part: 'panel', height: 1.47, y: .76, depth: .10 },
    { part: 'cap', height: capHeight, y: 1.505, depth: .15 },
    { part: 'base', height: .12, y: .10, depth: .14 },
  ]) {
    const backZ = insideBack + depth / 2;
    if (part === 'base') {
      box(wainscot, innerHalf * 2, height, depth, timber, 0, y, backZ)
        .name = 'lair-wainscot-back-base';
    } else {
      box(wainscot, leftJamb + innerHalf, height, depth, timber, (leftJamb - innerHalf) / 2, y, backZ)
        .name = `lair-wainscot-back-left-${part}`;
      box(wainscot, innerHalf - rightJamb, height, depth, timber, (rightJamb + innerHalf) / 2, y, backZ)
        .name = `lair-wainscot-back-right-${part}`;
      const sectionTop = part === 'cap' ? openingBottom : openingBottom - capHeight;
      const sectionBottom = part === 'cap' ? sectionTop - capHeight : y - height / 2;
      box(wainscot, openingHalf * 2, sectionTop - sectionBottom, depth, timber,
        openingX, (sectionTop + sectionBottom) / 2, backZ).name = `lair-wainscot-back-${part}`;
    }
    const start = insideBack + depth;
    for (const side of [-1, 1]) {
      box(wainscot, depth, height, ROOM_END - start, timber,
        side * (innerHalf - depth / 2), y, (start + ROOM_END) / 2)
        .name = `lair-wainscot-${side < 0 ? 'left' : 'right'}-${part}`;
    }
  }
  // Set all ceiling timbers into the surface so light cannot show at the seam.
  const timberTop = ceilingBottom + .02;
  const wallBeamHeight = .24;
  const wallBeamY = timberTop - wallBeamHeight / 2;
  for (const side of [-1, 1]) {
    box(staticGroup, .22, wallBeamHeight, ROOM_LENGTH - .1, timber,
      side * 8.29, wallBeamY, ROOM_CENTER_Z).name = `lair-wall-beam-${side < 0 ? 'left' : 'right'}`;
  }
  // Leave the centre of the back wall open for the enlarged arched window.
  for (const [index, x] of [-8.25, -4.68, 4.68, 8.25].entries()) {
    box(staticGroup, .26, 13.35, .27, timber, x, 6.64, -5.32).name = `lair-wall-post-${index}`;
    box(staticGroup, .37, .20, .39, timber, x, timberTop - wallBeamHeight - .09, -5.31);
  }
  // Alternate ribs carry the three chandeliers.
  for (const [beamIndex, z] of CEILING_BEAM_Z.entries()) {
    box(staticGroup, 17.15, .30, .33, timber, 0, timberTop - .15, z)
      .name = `lair-ceiling-beam-${beamIndex}`;
    for (const x of [-8.22, 8.22]) box(staticGroup, .39, .40, .48, timber, x, 13.22, z);
  }
  box(staticGroup, 17.22, wallBeamHeight, .30, timber, 0, wallBeamY, -5.39)
    .name = 'lair-wall-beam-back';
  // The chandeliers are in lamps.js.
  // A worn, woven carpet beneath the central table.
  const rugTex = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#625d4c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#928065'; ctx.lineWidth = 20; ctx.strokeRect(50, 50, w - 100, h - 100);
    ctx.strokeStyle = '#423d35'; ctx.lineWidth = 8; ctx.strokeRect(83, 83, w - 166, h - 166);
    for (let x = 130; x < w - 100; x += 115) for (let y = 150; y < h - 100; y += 115) {
      ctx.strokeStyle = '#968c73'; ctx.lineWidth = 6; ctx.beginPath();
      ctx.moveTo(x, y - 30); ctx.lineTo(x + 30, y); ctx.lineTo(x, y + 30); ctx.lineTo(x - 30, y); ctx.closePath(); ctx.stroke();
    }
  });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(6.4, .012, 4.3), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.name = 'planning-rug';
  rug.position.set(-.1, .0445, 1.2); rug.receiveShadow = true; staticGroup.add(rug);

  // Roof joists, tall posts and perimeter trim used to project enormous
  // diagonal shadow bars onto the gallery wall and floor. The architecture
  // receives light, while furniture added after buildShell keeps its own
  // normal contact shadows.
  staticGroup.traverse(object => {
    if (object.isMesh) object.castShadow = false;
  });
  return rightFinish;
}
