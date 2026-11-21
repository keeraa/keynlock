// @ts-check
import * as THREE from 'three';
import { createAmbientParticles } from './ambient-particles.js';

// The gramophone corner and the floating dust.
export function buildGramophone(kit) {
  const { m, staticGroup, animated, box, cylinder, rod, zoneTarget, makeTable } = kit;
  const surfaceY = .88;
  const chest = makeTable(staticGroup, 1.37, .76, 1.97, -3.67, surfaceY - .18);
  chest.name = 'gramophone-table';
  box(chest, 1.43, .12, .78, m.ash, 0, surfaceY - .06, 0, .025).name = 'gramophone-tabletop';
  box(chest, 1.26, .55, .54, m.darkWood, 0, surfaceY - .54, -.02, .03);
  box(chest, 1.12, .36, .05, m.walnut, 0, surfaceY - .52, .272);
  cylinder(chest, .038, .038, .04, m.oldBrass, 0, surfaceY - .53, .314, 14).rotation.x = Math.PI / 2;
  const gram = new THREE.Group(); gram.position.set(0, surfaceY, 0); chest.add(gram);
  box(gram, .95, .23, .67, m.darkWood, 0, .115, 0, .04);
  const vinyl = cylinder(gram, .34, .34, .018, m.charcoal, -.18, .23, .01, 36);
  cylinder(gram, .06, .06, .021, m.oldBrass, -.18, .244, .01, 20);
  rod(gram, [.22, .22, .23], [.02, .30, .01], .021, m.oldBrass);
  rod(gram, [.01, .30, .01], [-.05, .238, -.02], .015, m.oldBrass);
  const horn = new THREE.Group(); horn.position.set(.37, .224, -.16); gram.add(horn);
  rod(horn, [0,0,0], [0,.65,0], .052, m.oldBrass).name = 'gramophone-horn-stem';
  const pts = [new THREE.Vector2(.06,0),new THREE.Vector2(.08,.2),new THREE.Vector2(.13,.38),new THREE.Vector2(.27,.54),new THREE.Vector2(.47,.72),new THREE.Vector2(.54,.77)];
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#ba9050', metalness: .59, roughness: .38, side: THREE.DoubleSide }));
  bell.position.y = .44; bell.rotation.z = -.45; bell.castShadow = true; horn.add(bell);
  const mouth = pts.at(-1);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(mouth.x, .018, 6, 32), m.oldBrass);
  rim.position.set(0, mouth.y, 0).applyQuaternion(bell.quaternion).add(bell.position);
  const bellAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(bell.quaternion);
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bellAxis);
  rim.castShadow = true;
  horn.add(rim);
  vinyl.userData.dynamic = true;   // spins: keep it out of the static merge
  animated.push(t => { vinyl.rotation.y = t * .12; });
  zoneTarget('gramophone', [1.97, 1.55, -3.68], [1.58, 2.25, 1.12]);
  return chest;
}

/** @param {any} kit @param {{ windowLight?: { shaderUniforms: Record<string, { value: any }> } }} [options] */
export function buildDetails(kit, { windowLight } = {}) {
  const { staticGroup, animated } = kit;
  // The wall sconces are in lamps.js.
  const ambientParticles = createAmbientParticles(staticGroup, { windowLight });
  animated.push(t => ambientParticles.update(t));
  return ambientParticles;
}
