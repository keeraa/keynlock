import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {TREE_SPECIES,createCityTrees} from '../js/path-builder/tree-art.js';
import {starterTrees,normalizeLandscape,treePlacementCheck,riverIntersectsTrees,
  landscapeEraseTarget,LANDSCAPE_LIMITS} from '../js/path-builder/landscape-model.js';

const seed=starterTrees();
assert.equal(seed.length,28,'Starter town includes 28 varied trees');
assert.deepEqual(new Set(seed.map(tree=>tree.kind)),new Set(['oak','linden','maple']));
assert.equal(Object.keys(TREE_SPECIES).length,3);
assert.ok(seed.every(t=>t.size>=.75&&t.size<=1.35));
const landscape=normalizeLandscape({trees:seed});
assert.equal(landscape.trees.length,28,'Trees survive landscape normalization');
assert.equal(landscapeEraseTarget(landscape,seed[0].x,seed[0].z)?.type,'tree');
assert.equal(treePlacementCheck(landscape,{x:seed[0].x,z:seed[0].z}).valid,false);
assert.equal(treePlacementCheck(landscape,{x:210,z:210}).valid,true);
assert.equal(treePlacementCheck(landscape,{x:210,z:210},[
  {x:210,z:210,width:10,depth:10,rotation:0}]).valid,false);
assert.equal(treePlacementCheck(landscape,{x:210,z:210},[],{
  paths:[{p:[[205,210],[215,210]]}]}).valid,false);
assert.equal(riverIntersectsTrees({width:7,points:[[seed[0].x,-100],[seed[0].x,100]]},seed),true);
assert.equal(normalizeLandscape({trees:Array.from({length:LANDSCAPE_LIMITS.trees+8},(_,i)=>
  ({kind:'oak',x:i,z:0}))}).trees.length,LANDSCAPE_LIMITS.trees);

// Fake the 2D brush context only; exercise real Three.js instancing without a GPU.
const brush={fillRect(){},save(){},restore(){},translate(){},rotate(){},beginPath(){},
  ellipse(){},fill(){},moveTo(){},lineTo(){},closePath(){},stroke(){},quadraticCurveTo(){},
  createRadialGradient(){return {addColorStop(){}};}};
globalThis.document={createElement:tag=>{
  assert.equal(tag,'canvas');return {width:0,height:0,getContext:()=>brush};
}};
const scene=new THREE.Scene(),trees=createCityTrees(THREE,scene);
const meshCounts=()=>scene.children.filter(item=>item.userData.cityTrees).map(item=>item.count);
assert.equal(meshCounts().length,15,'Three species use 15 instanced draw pools');
trees.setTrees(seed,()=>2.5);
const leaves=scene.children.filter(item=>item.userData.cityLeaves);
assert.equal(leaves.length,9,'Three painted cutout variations per species');
const woody=scene.children.filter(item=>item.userData.cityTrees&&!item.userData.cityLeaves);
const trunks=woody.filter(mesh=>mesh.geometry.parameters.heightSegments===8);
const branches=woody.filter(mesh=>mesh.geometry.parameters.heightSegments===1);
assert.equal(trunks.length,3);
assert.equal(branches.length,3);
assert.ok(trunks.every(mesh=>mesh.geometry.index.count/3===160),
  'Open-ended, curved trunks use a compact 160-triangle silhouette');
assert.ok(branches.every(mesh=>mesh.geometry.index.count/3===14),
  'Hidden branch endcaps have been removed without changing branch profiles');
const expectedTufts=seed.reduce((sum,t)=>sum+TREE_SPECIES[t.kind].groves.reduce(
  (n,grove)=>n+grove.count,0),0);
assert.equal(leaves.reduce((sum,item)=>sum+item.count,0),expectedTufts,
  'Each tree has structured overlapping leaf sprays');
for(const mesh of leaves){
  assert.equal(mesh.geometry.index.count/3,6,'Crossed transparent cards stay low-poly');
  assert.ok(mesh.material.alphaTest>0,'Leaf cutouts expose branches and daylight');
  assert.equal(mesh.userData.noOutline,true,'Card edges do not receive a heavy outline');
}
assert.ok(meshCounts().reduce((a,b)=>a+b,0)>expectedTufts+seed.length,
  'Short and main woody branches are visibly present');
const budget=Object.fromEntries(Object.entries(TREE_SPECIES).map(([kind,spec])=>{
  const tufts=spec.groves.reduce((n,grove)=>n+grove.count,0);
  const branchesPerTree=spec.limbs*3+2+Math.ceil(tufts/3);
  const trianglesPerTree=160+branchesPerTree*14+tufts*6;
  assert.ok(trianglesPerTree<=920,`${kind}: full-quality tree exceeds polygon budget`);
  return [kind,trianglesPerTree];
}));
assert.deepEqual(budget,{oak:914,linden:872,maple:914});
assert.equal(seed.reduce((n,tree)=>n+budget[tree.kind],0),25214,
  'Starter map triangle budget is exact and stable');
for(const instance of scene.children.filter(item=>item.isInstancedMesh)){
  if(!instance.count)continue;
  const matrix=new THREE.Matrix4();instance.getMatrixAt(0,matrix);
  assert.ok(matrix.elements.every(Number.isFinite),'Instance matrix must be finite');
}
trees.setTrees([],()=>0);
assert.ok(meshCounts().every(count=>count===0),'Clearing trees hides every instance');
trees.dispose();
assert.equal(scene.children.filter(item=>item.userData.cityTrees).length,0);
console.log('City vegetation: three colors, seeds, collisions, WebGL instancing, cleanup OK');
