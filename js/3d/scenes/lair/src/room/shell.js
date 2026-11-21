import * as THREE from 'three';
import { canvasTexture } from '../materials.js';

// The long room itself: floor, walls, ceiling, rug and the right-wall finish.
export function buildShell(kit) {
  const { m, scene, staticGroup, shadow, box, cylinder, sphere, plane } = kit;
  scene.background = new THREE.Color('#2f3834');
  scene.fog = new THREE.Fog('#514d40', 39, 94);
  // Thirty metres of exhibition space on the left, with a matching full-
  // length workshop wing on the right. The arched window stays on the far end.
  const longRoomStart = -5.72;
  const longRoomEnd = 26.42;
  const longRoomLength = longRoomEnd - longRoomStart;
  const longRoomCenter = (longRoomEnd + longRoomStart) / 2;
  const floorBase = box(staticGroup, 17.3, .22, longRoomLength + .3, m.darkWood, 0, -.14, longRoomCenter);
  floorBase.castShadow = false;
  for (let i = 0; i < 99; i++) {
    const z = -5.64 + i * .325;
    const plank = box(staticGroup, 17.1, .047, .312, i % 6 === 0 ? m.floorAlternate : m.floor, 0, .015, z);
    plank.castShadow = false;
    if (i % 5 === 0) box(staticGroup, 17.1, .006, .009, m.darkWood, 0, .045, z - .155).castShadow = false;
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
  const openingX = -.05, openingHalf = 4.23, openingBottom = 2.13;
  const openingSpring = 7.43, openingRise = 2.15;
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
  box(staticGroup, .27, 13.8, longRoomLength, m.plaster, -8.55, 6.76, longRoomCenter).castShadow = false;
  box(staticGroup, .27, 13.8, longRoomLength, m.plaster, 8.55, 6.76, longRoomCenter).castShadow = false;
  box(staticGroup, 17.5, .20, longRoomLength, m.darkWood, 0, 13.62, longRoomCenter).castShadow = false;
  // The left wall keeps the exact ochre gouache wallpaper from the atelier.
  const leftFinish = plane(staticGroup, longRoomLength - .12, 13.55, m.restorationWall, -8.391, 6.72, longRoomCenter);
  leftFinish.rotation.y = Math.PI / 2;
  leftFinish.name = 'restoration-left-wall';
  // One continuous sage-green tiled finish covers the entire right wall.
  // It sits just in front of the plaster, from the floor to the ceiling.
  const rightFinish = plane(staticGroup, longRoomLength - .08, 13.54, m.alchemyTile, 8.392, 6.77, longRoomCenter);
  rightFinish.rotation.y = -Math.PI / 2;
  rightFinish.castShadow = false;
  rightFinish.name = 'alchemy-right-wall';

  // Wainscot panels, framed with dark timber; the left wall is kept free for the restoration easel.
  box(staticGroup, 17.25, 1.65, .08, m.agedWood, 0, .9, -5.39);
  box(staticGroup, 17.25, .12, .17, m.darkWood, 0, 1.76, -5.28);
  box(staticGroup, 17.25, .2, .23, m.walnut, 0, .18, -5.26);
  for (let i = -7; i <= 7; i++) {
    box(staticGroup, .09, 1.45, .09, m.darkWood, i * 1.18, .93, -5.31);
    if (i < 7) box(staticGroup, .92, .04, .045, m.oldBrass, i * 1.18 + .59, 1.49, -5.23);
  }
  // The restoration side retains its wood wainscot. Keep the tiled side clear.
  box(staticGroup, .08, 1.66, longRoomLength - .1, m.agedWood, -8.35, .88, longRoomCenter);
  box(staticGroup, .19, .15, longRoomLength - .1, m.darkWood, -8.23, 1.77, longRoomCenter);
  box(staticGroup, .22, .20, longRoomLength - .1, m.walnut, -8.20, .17, longRoomCenter);
  // No timber line across the middle of the double-height room.
  for (const side of [-1, 1]) box(staticGroup, .22, .20, longRoomLength - .1, m.walnut, side * 8.29, 13.30, longRoomCenter);
  // Leave the centre of the back wall open for the enlarged arched window.
  for (const x of [-8.25, -4.68, 4.68, 8.25]) {
    box(staticGroup, .31, 13.35, .32, m.darkWood, x, 6.64, -5.32);
    box(staticGroup, .45, .22, .48, m.walnut, x, 12.70, -5.31);
  }
  for (let z = -4.8, beamIndex = 0; z < longRoomEnd; z += 3.1, beamIndex++) {
    box(staticGroup, 17.15, .30, .34, m.darkWood, 0, 13.37, z)
      .name = `lair-ceiling-beam-${beamIndex}`;
    for (const x of [-8.15, 8.15]) box(staticGroup, .42, .44, .52, m.walnut, x, 13.22, z);
  }
  box(staticGroup, 17.22, .25, .32, m.walnut, 0, 13.24, -5.29);
  // Small warm chandeliers make the extra storey visually legible.
  for (const z of [-2.6, 4.2, 11.8, 19.8]) {
    cylinder(staticGroup, .042, .042, 1.25, m.oldBrass, 0, 12.54, z, 10);
    cylinder(staticGroup, .34, .27, .15, m.oldBrass, 0, 11.89, z, 16);
    const globe = sphere(staticGroup, .25, new THREE.MeshBasicMaterial({ color: '#ffdfaa' }), 0, 11.75, z);
    globe.castShadow = false;
    const light = new THREE.PointLight('#ffd6a3', 6, 9, 2);
    light.position.set(0, 11.75, z); staticGroup.add(light);
  }
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
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.3), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-.1, .05, 1.2); rug.receiveShadow = true; staticGroup.add(rug);

  // Roof joists, tall posts and perimeter trim used to project enormous
  // diagonal shadow bars onto the gallery wall and floor. The architecture
  // receives light, while furniture added after buildShell keeps its own
  // normal contact shadows.
  staticGroup.traverse(object => {
    if (object.isMesh) object.castShadow = false;
  });
  return rightFinish;
}
