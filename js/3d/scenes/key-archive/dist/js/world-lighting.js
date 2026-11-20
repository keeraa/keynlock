import * as THREE from '../vendor/three.js';
import { cylinder } from './world-architecture.js';

export const CHANDELIER_Z = [-13, 0, 13];

export function makeChandeliers(scene, mat) {
  const fallback = new THREE.Group();
  scene.add(fallback);
  for (const z of CHANDELIER_Z) {
    // Antique forged ring, curved hangers, candle dishes and tapered flames.
    cylinder(fallback, .048, 5.25, [0, 10.735, z], mat.agedBronze);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.43, .057, 8, 48), mat.agedBronze);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 8.05, z);
    fallback.add(ring);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, .025, 6, 40), mat.agedBronze);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.set(0, 8.12, z);
    fallback.add(innerRing);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const x = Math.cos(a) * 1.43;
      const offsetZ = Math.sin(a) * 1.43;
      const brace = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 9.17, z),
        new THREE.Vector3(Math.cos(a) * .85, 8.37, z + Math.sin(a) * .85),
        new THREE.Vector3(x, 8.06, z + offsetZ),
      );
      fallback.add(new THREE.Mesh(new THREE.TubeGeometry(brace, 18, .025, 5, false), mat.agedBronze));
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(.18, .09, .065, 12), mat.agedBronze);
      dish.position.set(x, 8.17, z + offsetZ);
      fallback.add(dish);
      cylinder(fallback, .057, .27, [x, 8.32, z + offsetZ], mat.carvedWood, 10);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(.052, 8, 8), mat.light);
      flame.scale.set(.75, 1.65, .75);
      flame.position.set(x, 8.53, z + offsetZ);
      fallback.add(flame);
    }
    const light = new THREE.PointLight(0xffd5a5, 12, 15, 2);
    light.position.set(0, 7.75, z);
    scene.add(light);
  }
  return fallback;
}
