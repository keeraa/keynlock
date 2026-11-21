// @ts-check
import * as THREE from 'three';
import { createAmbientParticles } from '../engine/ambient-particles.js';

// The gramophone corner, hanging lamps and the floating dust.
export function buildGramophone(kit) {
  const { m, staticGroup, animated, box, cylinder, rod, zoneTarget, makeTable } = kit;
  const chest = makeTable(staticGroup, 1.37, .76, 1.97, -3.67, 1.17);
  chest.name = 'gramophone-table';
  box(chest, 1.43, .12, .78, m.ash, 0, 1.29, 0, .025);
  box(chest, 1.26, .55, .54, m.darkWood, 0, .81, -.02, .03);
  box(chest, 1.12, .36, .05, m.walnut, 0, .83, .29);
  cylinder(chest, .038, .038, .04, m.oldBrass, 0, .82, .33, 14).rotation.x = Math.PI / 2;
  const gram = new THREE.Group(); gram.position.set(0, 1.37, 0); chest.add(gram);
  box(gram, .95, .23, .67, m.darkWood, 0, .11, 0, .04);
  const vinyl = cylinder(gram, .34, .34, .018, m.charcoal, -.18, .23, .01, 36);
  cylinder(gram, .06, .06, .021, m.oldBrass, -.18, .244, .01, 20);
  rod(gram, [.22, .22, .23], [.02, .30, .01], .021, m.oldBrass);
  rod(gram, [.01, .30, .01], [-.05, .29, -.02], .015, m.oldBrass);
  const horn = new THREE.Group(); horn.position.set(.37, .24, -.16); gram.add(horn);
  rod(horn, [0,0,0], [0,.65,0], .052, m.oldBrass);
  const pts = [new THREE.Vector2(.06,0),new THREE.Vector2(.08,.2),new THREE.Vector2(.13,.38),new THREE.Vector2(.27,.54),new THREE.Vector2(.47,.72),new THREE.Vector2(.54,.77)];
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#ba9050', metalness: .59, roughness: .38, side: THREE.DoubleSide }));
  bell.position.y = .44; bell.rotation.z = -.45; bell.castShadow = true; horn.add(bell);
  cylinder(horn, .54, .54, .018, m.oldBrass, -.31, 1.13, 0, 32).rotation.z = -.45;
  animated.push(t => { vinyl.rotation.y = t * .12; });
  zoneTarget('gramophone', [1.97, 2.42, -3.68], [1.58, 2.65, 1.12]);
}

export function buildDetails(kit) {
  const { m, staticGroup, animated, box, sphere } = kit;
  // Keep the tall window wall free from pictures and the former upper gallery.
  // Column lamps create pools of warm light around the room.
  for (const x of [-7.98, 7.98]) for (const z of [-1.10, 8.15, 17.35, 24.65]) {
    const lamp = new THREE.Group(); lamp.position.set(x, 3.10, z); staticGroup.add(lamp);
    box(lamp, .14, .65, .22, m.oldBrass);
    sphere(lamp, .22, new THREE.MeshBasicMaterial({ color: '#f0c591', transparent: true, opacity: .65 }), 0, 0, .19);
    const light = new THREE.PointLight('#ffc183', 3.5, 5.5, 2); light.position.set(0, 0, .35); lamp.add(light);
  }
  const ambientParticles = createAmbientParticles(staticGroup);
  animated.push(t => ambientParticles.update(t));
  return ambientParticles;
}
