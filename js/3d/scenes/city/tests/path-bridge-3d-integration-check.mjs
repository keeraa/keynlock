import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';
import {createStoneBridge} from '../js/path-builder/stone-bridge.js';
import {createGrandBridge} from '../js/path-builder/grand-bridge.js';
import {bridgeDeckHeight,bridgeProfiles,createLandscapeSampler,
  normalizeLandscape} from '../js/path-builder/landscape-model.js';
import {bridgeWorld,bridgeLocal,bridgeRoadPortal,bridgeRoadWidth,
  bridgePavingCutout,bridgeWaterOpening,BRIDGE_ROAD_OVERLAP} from '../js/path-builder/bridge-frame.js';
import {KEYNLOCK_FIXED_BRIDGES,fixedBridgeWaterAt} from '../js/path-builder/keynlock-fixed-bridges.js';

const delta=(actual,expected,label,tolerance=1e-4)=>assert.ok(
  Math.abs(actual-expected)<tolerance,`${label}: ${actual} ≠ ${expected}`);

const river=normalizeLandscape({
  rivers:[{id:'integration-river',width:19,depth:4.2,points:[[0,-80],[0,80]]}],
  bridges:[{id:'integration-bridge',riverId:'integration-river',t:.5}],
});
const samples=createLandscapeSampler(river);
const profiles=[bridgeProfiles(river).find(item=>item.id==='integration-bridge'),
  ...KEYNLOCK_FIXED_BRIDGES];
assert.ok(profiles.every(Boolean));

for(const profile of profiles){
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const instance=profile.fixed?createGrandBridge(THREE,profile,null,material):
    createStoneBridge(THREE,profile,null,material);
  const model=instance.group;
  model.updateMatrixWorld(true);
  const paving=model.children.find(item=>item.name==='Брусчатка дороги на мосту');
  const slab=model.children.find(item=>item.name==='Цельная каменная плита под мостовой');
  assert.ok(paving?.geometry?.attributes?.uv,`${profile.id}: bridge paving is visible`);
  assert.ok(slab,`${profile.id}: bridge has a solid backing`);
  assert.equal(paving.material,material,`${profile.id}: shares the street paving material`);
  const vertices=paving.geometry.getAttribute('position');
  const uvs=paving.geometry.getAttribute('uv');
  assert.equal(vertices.count,uvs.count);
  const width=bridgeRoadWidth(profile),cutout=bridgePavingCutout(profile);
  let minAlong=Infinity,maxAlong=-Infinity,minAcross=Infinity,maxAcross=-Infinity;
  for(let i=0;i<vertices.count;i++){
    const along=vertices.getX(i),across=vertices.getZ(i);
    minAlong=Math.min(minAlong,along);maxAlong=Math.max(maxAlong,along);
    minAcross=Math.min(minAcross,across);maxAcross=Math.max(maxAcross,across);
    delta(vertices.getY(i),bridgeDeckHeight(profile,along)+.075,
      `${profile.id}: paving sits above arched deck`);
    assert.ok(Number.isFinite(uvs.getX(i))&&Number.isFinite(uvs.getY(i)));
  }
  delta(minAlong,-profile.span/2,`${profile.id}: first bank reached`);
  delta(maxAlong,profile.span/2,`${profile.id}: second bank reached`);
  delta(minAcross,-width/2,`${profile.id}: left parapet clearance`);
  delta(maxAcross,width/2,`${profile.id}: right parapet clearance`);
  for(const side of [-1,1]){
    const portal=bridgeRoadPortal(profile,side);
    const {along,across}=bridgeLocal(profile,...portal);
    delta(Math.abs(along),profile.span/2-BRIDGE_ROAD_OVERLAP,
      `${profile.id}: road endpoint lies inside full-length deck`);
    delta(across,0,`${profile.id}: road endpoint is centred, not offset`);
    assert.ok(Math.abs(along)<Math.abs(maxAlong)+1e-4);
    assert.ok(Math.abs(along)<=cutout.halfLength+1e-4);
    // The dry ramp lies beyond the water mask and cannot inherit river paving.
    const local=bridgeLocal(profile,...bridgeWorld(profile,side*(profile.span/2+1)));
    assert.ok(Math.abs(local.along)>cutout.halfLength);
  }
  const mid=bridgeWorld(profile,0);
  if(profile.fixed){
    assert.ok(fixedBridgeWaterAt(...mid),`${profile.id}: river is open under the arch`);
    assert.ok(!fixedBridgeWaterAt(...bridgeWorld(profile,profile.span/2)),
      `${profile.id}: both dry landfalls stay above the river`);
    const water=bridgeWaterOpening(profile);
    assert.ok(water.halfLength<profile.span/2,
      `${profile.id}: water mask stops before the abutment`);
  }else{
    assert.ok(samples.heightAt(...mid)<bridgeDeckHeight(profile,0),
      `${profile.id}: excavated channel stays below the bridge`);
  }
  // A downward 3D ray must hit the arched paving, never fall through gaps.
  for(const along of [-profile.span*.4,0,profile.span*.4]){
    const [x,z]=bridgeWorld(profile,along);
    const cast=new THREE.Raycaster(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));
    assert.ok(cast.intersectObject(paving,false).length,
      `${profile.id}: no holes in road mesh at ${along.toFixed(2)} metres`);
  }
  instance.dispose();material.dispose();
}
console.log(`3D bridge regression: ${profiles.length} spans, paving, portals, arches, river masks verified`);

// A diagonal player-built crossing must not become four-directional terrain.
// The route through the bridge extends along the deck axis onto both banks.
const bounds={minX:-68,maxX:68,minZ:-68,maxZ:68};
const diagonal=normalizeLandscape({
  rivers:[{id:'diagonal-river',width:9,depth:2,points:[[-200,-145],[200,145]]}],
  bridges:[{id:'diagonal-bridge',riverId:'diagonal-river',t:.5}],
});
const diagonalBridge=bridgeProfiles(diagonal)[0];
const houses=[
  {id:'north',x:8,z:-19,rotation:0,width:8,depth:7},
  {id:'south',x:9,z:27,rotation:Math.PI,width:8,depth:7},
];
for(const buildings of [houses,[...houses].reverse()]){
  const layout=planBuildingPaths(buildings,{bounds,landscape:diagonal});
  assert.equal(layout.connected,2,'Both bridge approaches connect to the buildings');
  const route=layout.paths[0].p.map(point=>bridgeLocal(diagonalBridge,...point));
  const half=diagonalBridge.span/2;
  const crossing=route.slice(1).map((end,i)=>[route[i],end]).find(([start,end])=>
    Math.min(start.along,end.along)<-half-2&&Math.max(start.along,end.along)>half+2);
  assert.ok(crossing,'A single straight section spans the deck and both dry approaches');
  for(const point of crossing)delta(point.across,0,'The road stays centred between the parapets');
  assert.ok(layout.network.findRoute('north','south'),'The walkable graph uses the same crossing');
}
console.log('Diagonal bridge regression: routes pass along the deck and join both ends');
