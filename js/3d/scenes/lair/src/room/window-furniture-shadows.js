// @ts-check
import * as THREE from 'three';

const mapSize = 256;
const edge = (ax, ay, bx, by, x, y) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);

function rasterize(depths, vertices, a, b, c, range) {
  const ax = vertices[a], ay = vertices[a + 1];
  const bx = vertices[b], by = vertices[b + 1];
  const cx = vertices[c], cy = vertices[c + 1];
  const area = edge(ax, ay, bx, by, cx, cy);
  if (Math.abs(area) < 1e-5) return;
  const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const right = Math.min(mapSize - 1, Math.ceil(Math.max(ax, bx, cx)));
  const bottom = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const top = Math.min(mapSize - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = bottom; y <= top; y++) {
    for (let x = left; x <= right; x++) {
      const u = edge(bx, by, cx, cy, x + .5, y + .5) / area;
      const v = edge(cx, cy, ax, ay, x + .5, y + .5) / area;
      const w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) continue;
      const distance = vertices[a + 2] * u + vertices[b + 2] * v + vertices[c + 2] * w;
      if (distance < 0 || distance >= range) continue;
      const offset = y * mapSize + x;
      depths[offset] = Math.min(depths[offset], Math.round(distance * 255 / range));
    }
  }
}

/**
 * Project the fixed furniture back onto the window, keeping the closest
 * triangle along each ray. Air, dust and floor can share this one texture.
 * @param {THREE.Object3D[]} furniture
 * @param {{ x: number, z: number, halfWidth: number, bottom: number, top: number,
 *   range: number, slope: { x: number, y: number } }} window
 */
export function bakeWindowFurnitureShadows(furniture, window) {
  const depths = new Uint8Array(mapSize * mapSize).fill(255);
  const point = new THREE.Vector3();
  for (const root of furniture) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || !object.castShadow) return;
      const position = object.geometry.getAttribute('position');
      const indices = object.geometry.getIndex();
      const vertices = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        const distance = point.z - window.z;
        vertices[i * 3] = ((point.x + distance * window.slope.x - window.x) / (2 * window.halfWidth) + .5) * mapSize;
        vertices[i * 3 + 1] = (point.y + distance * window.slope.y - window.bottom) / (window.top - window.bottom) * mapSize;
        vertices[i * 3 + 2] = distance;
      }
      const count = indices?.count ?? position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const a = indices ? indices.getX(i) : i;
        const b = indices ? indices.getX(i + 1) : i + 1;
        const c = indices ? indices.getX(i + 2) : i + 2;
        rasterize(depths, vertices, 3 * a, 3 * b, 3 * c, window.range);
      }
    });
  }
  const texture = new THREE.DataTexture(depths, mapSize, mapSize, THREE.RedFormat);
  texture.name = 'lair-window-furniture-depth';
  texture.needsUpdate = true;
  return texture;
}
