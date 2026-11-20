import * as THREE from '../vendor/three.js';

// Join only opaque, immobile hall parts sharing the exact same material and
// shadow behavior. Small spatial buckets retain culling; UVs and normals are
// baked from each source transform, so the painted surfaces stay unchanged.
export function batchStaticHallMeshes(root) {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const center = new THREE.Vector3();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.visible || mesh.children.length ||
        Array.isArray(mesh.material) || mesh.material.transparent || mesh.material.opacity !== 1 ||
        Object.keys(mesh.userData).length || mesh.geometry.morphAttributes.position) return;
    const geometry = mesh.geometry;
    if (Object.keys(geometry.attributes).sort().join(',') !== 'normal,position,uv') return;
    center.setFromMatrixPosition(mesh.matrixWorld).applyMatrix4(inverseRoot);
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder,
      Math.floor(center.x / 8), Math.floor(center.y / 8), Math.floor(center.z / 8)].join(':');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  });
  let removed = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const positions = [], normals = [], uvs = [], indices = [];
    let offset = 0;
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone().applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld));
      const position = geometry.getAttribute('position');
      positions.push(...position.array);
      normals.push(...geometry.getAttribute('normal').array);
      uvs.push(...geometry.getAttribute('uv').array);
      if (geometry.index) for (const index of geometry.index.array) indices.push(offset + index);
      else for (let index = 0; index < position.count; index++) indices.push(offset + index);
      offset += position.count;
      geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const source = meshes[0];
    const batch = new THREE.Mesh(geometry, source.material);
    batch.castShadow = source.castShadow;
    batch.receiveShadow = source.receiveShadow;
    batch.renderOrder = source.renderOrder;
    batch.name = 'Static hall batch';
    root.add(batch);
    for (const mesh of meshes) mesh.removeFromParent();
    removed += meshes.length - 1;
  }
  return removed;
}
