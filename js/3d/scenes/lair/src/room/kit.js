import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from './materials.js';

// Shared building blocks for the room's parts: primitives with physical-scale
// wood UVs, painted labels, the zones' picking targets, tables and bottles.
export function createRoomKit(scene, m) {
  const anchors = {};
  const hitTargets = [];
  const animated = [];
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const shadow = mesh => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
  const paintedWood = new Set([m.walnut, m.agedWood, m.darkWood, m.ash, m.oak]);
  const woodPeriod = 1.45;
  // Scale each face by real-world dimensions so narrow rails don't squeeze an
  // entire gouache texture into a few centimetres of timber.
  const sizeWoodBoxUV = (geometry, w, h, d, { period = woodPeriod, grainAxis, offsetU = 0, offsetV = 0 } = {}) => {
    const uv = geometry.getAttribute('uv');
    const index = geometry.getIndex();
    const dimensions = { x: w, y: h, z: d };
    const axes = [['z', 'y'], ['z', 'y'], ['x', 'z'], ['x', 'z'], ['x', 'y'], ['x', 'y']];
    const visited = new Set();
    for (let face = 0; face < Math.min(axes.length, geometry.groups.length); face++) {
      const { start, count } = geometry.groups[face];
      const [uAxis, vAxis] = axes[face];
      const width = dimensions[uAxis], height = dimensions[vAxis];
      const turn = vAxis === grainAxis;
      for (let i = start; i < start + count; i++) {
        const vertex = index ? index.getX(i) : i;
        if (visited.has(vertex)) continue;
        visited.add(vertex);
        const u = uv.getX(vertex), v = uv.getY(vertex);
        uv.setXY(vertex,
          (turn ? v * height : u * width) / period + offsetU,
          (turn ? (1 - u) * width : v * height) / period + offsetV);
      }
    }
    uv.needsUpdate = true;
    geometry.userData.paintedWoodUV = true;
  };
  const box = (parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = 0) => {
    const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
    if (material === m.roomTimber) {
      // Architecture uses the long axis as the grain direction. World positions
      // select different parts of the same texture without new materials.
      const grainAxis = w >= h && w >= d ? 'x' : h >= d ? 'y' : 'z';
      sizeWoodBoxUV(geometry, w, h, d, {
        period: 3.8, grainAxis,
        offsetU: THREE.MathUtils.euclideanModulo(.125 * x + .11 * y + .13 * z, 1),
        offsetV: THREE.MathUtils.euclideanModulo(.19 * x + .07 * y + .09 * z, 1),
      });
    } else if (paintedWood.has(material)) {
      sizeWoodBoxUV(geometry, w, h, d);
    }
    const mesh = shadow(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const cylinder = (parent, rt, rb, h, material, x, y, z, segments = 18) => {
    const mesh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const sphere = (parent, r, material, x, y, z, segments = 16) => {
    const mesh = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, segments, 10), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const rod = (parent, a, b, radius, material, sides = 8) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius * .92, radius, direction.length(), sides);
    if (paintedWood.has(material)) {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i,
        uv.getX(i) * 2 * Math.PI * radius / woodPeriod,
        uv.getY(i) * direction.length() / woodPeriod);
      uv.needsUpdate = true;
    }
    const mesh = shadow(new THREE.Mesh(geometry, material));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    parent.add(mesh); return mesh;
  };
  const plane = (parent, w, h, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z); parent.add(mesh); mesh.receiveShadow = true; return mesh;
  };
  const label = (parent, text, x, y, z, width = 1.8, height = .3) => {
    const texture = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#c4aa79'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#695335'; ctx.lineWidth = 14; ctx.strokeRect(13, 13, w - 26, h - 26);
      ctx.fillStyle = '#382d20'; ctx.font = `bold ${Math.min(88, Math.floor(1420 / text.length))}px Georgia`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
    }, 1024, 180);
    const paper = new THREE.MeshStandardMaterial({
      map: texture, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    return plane(parent, width, height, paper, x, y, z);
  };
  const zoneTarget = (id, position, size) => {
    anchors[id] = new THREE.Vector3(...position);
    const collider = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    collider.position.set(...position);
    collider.userData.zone = id;
    scene.add(collider); hitTargets.push(collider);
  };

  function makeTable(parent, w, d, x, z, topY, floorY = .0385) {
    const table = new THREE.Group(); table.position.set(x, floorY, z); parent.add(table);
    box(table, w, .2, d, m.walnut, 0, topY, 0, .04);
    box(table, w - .16, .12, d - .16, m.darkWood, 0, topY - .15, 0);
    for (const xx of [-w / 2 + .19, w / 2 - .19]) for (const zz of [-d / 2 + .19, d / 2 - .19]) {
      box(table, .16, topY - .1, .18, m.agedWood, xx, (topY - .1) / 2, zz);
      box(table, .22, .12, .21, m.darkWood, xx, .06, zz);
    }
    box(table, w - .27, .13, .08, m.darkWood, 0, topY - .38, d / 2 - .20);
    return table;
  }

  function bottle(parent, x, baseY, z, color, height = .42, radius = .14) {
    const y = baseY + height / 2;
    cylinder(parent, radius, radius * 1.07, height, m.glass, x, y, z, 16);
    cylinder(parent, radius * .86, radius * .87, height * .44, color, x, y - height * .22, z, 16).castShadow = false;
    cylinder(parent, radius * .38, radius * .44, .11, m.oldBrass, x, y + height / 2 + .05, z, 12);
    cylinder(parent, radius * .43, radius * .43, .075, m.darkWood, x, y + height / 2 + .13, z, 12);
  }

  return {
    m, scene, staticGroup, anchors, hitTargets, animated,
    shadow, paintedWood, woodPeriod, sizeWoodBoxUV,
    box, cylinder, sphere, rod, plane, label, zoneTarget, makeTable, bottle,
  };
}
