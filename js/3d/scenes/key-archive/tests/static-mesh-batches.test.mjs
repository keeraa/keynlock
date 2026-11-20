import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { batchStaticHallMeshes } from '../dist/js/static-mesh-batches.js';

function vertices(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), result = [];
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    const indices = geometry.index?.array ?? Array.from({length:p.count}, (_,i)=>i);
    for (const i of indices) result.push([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i)]);
    geometry.dispose();
  });
  return result;
}

test('static hall batching preserves transformed triangles, normals, UVs and shared material', () => {
  const root = new THREE.Group();root.position.set(12,1,-8);root.rotation.y=.4;
  const group = new THREE.Group();group.position.set(1,2,1);group.rotation.y=.6;root.add(group);
  const material = new THREE.MeshStandardMaterial();
  for(let i=0;i<2;i++){
    const mesh=new THREE.Mesh(i ? new THREE.BoxGeometry().toNonIndexed() : new THREE.BoxGeometry(),material);
    mesh.position.set(i,0,0);mesh.scale.set(1,2,.5);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  const expected=vertices(root);
  assert.equal(batchStaticHallMeshes(root),1);
  const actual=vertices(root);
  assert.equal(actual.length,expected.length);
  actual.forEach((vertex,i)=>vertex.forEach((value,j)=>assert.ok(Math.abs(value-expected[i][j])<1e-5)));
  const batch=root.children.find(o=>o.isMesh);
  assert.equal(batch.material,material);
  assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);
  assert.ok(batch.geometry.boundingSphere.radius>0);
});

test('batching keeps spatial culling, transparency, shadow modes and animated instances separate', () => {
  const root=new THREE.Group(), material=new THREE.MeshStandardMaterial();
  const add=(x,mat=material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(),mat);mesh.position.x=x;root.add(mesh);return mesh};
  const near=[add(1),add(2)];
  const far=add(20), shadow=add(1);shadow.castShadow=true;
  const transparent=add(1,new THREE.MeshBasicMaterial({transparent:true,opacity:.5}));
  const hidden=add(1);hidden.visible=false;
  const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,4);root.add(instanced);
  const animated=add(1);animated.userData.animated=true;
  assert.equal(batchStaticHallMeshes(root),1);
  for(const mesh of near)assert.equal(mesh.parent,null);
  for(const mesh of [far,shadow,transparent,hidden,instanced,animated])assert.equal(mesh.parent,root);
});
