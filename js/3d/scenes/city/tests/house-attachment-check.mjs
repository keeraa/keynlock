import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createHouseModel} from '../modules/house-builder/core/house-model.js';
import {HOUSE_DEFAULTS} from '../modules/house-builder/core/house-config.js';

const configs=[
  {...HOUSE_DEFAULTS},
  {...HOUSE_DEFAULTS,floors:4,width:12,depth:10,frontWindows:5,sideWindows:4,
    balcony:true,shutters:true,timberFrame:true,plasterDamage:true,damageAmount:65},
  {...HOUSE_DEFAULTS,floors:2,width:6,depth:5,roofType:'hip',windowStyle:'straight',
    doorStyle:'straight',balcony:true,shutters:false},
  {...HOUSE_DEFAULTS,floors:1,width:10,roofType:'flat',chimney:false,timberFrame:true},
];
const touch=(a,b,slack=.026)=>a.min.x<=b.max.x+slack&&b.min.x<=a.max.x+slack&&
  a.min.y<=b.max.y+slack&&b.min.y<=a.max.y+slack&&
  a.min.z<=b.max.z+slack&&b.min.z<=a.max.z+slack;

for(const [caseIndex,config] of configs.entries())for(const detail of ['high','medium','low']){
  const model=createHouseModel(THREE,config,{detail});
  const root=model.group;
  root.updateMatrixWorld(true);
  const meshes=[];
  root.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const boxes=meshes.map(mesh=>new THREE.Box3().setFromObject(mesh));
  const shell=meshes.findIndex(mesh=>mesh.geometry.type==='BoxGeometry'&&
    Math.abs(mesh.geometry.parameters.width-config.width)<.001&&
    Math.abs(mesh.geometry.parameters.depth-config.depth)<.001);
  assert(shell>=0,`Case ${caseIndex}/${detail} has no load-bearing shell`);
  const attached=new Uint8Array(meshes.length);
  const queue=[shell];attached[shell]=1;
  for(let q=0;q<queue.length;q++){
    const current=queue[q];
    for(let i=0;i<meshes.length;i++)if(!attached[i]&&touch(boxes[current],boxes[i])){
      attached[i]=1;queue.push(i);
    }
  }
  const detached=meshes.filter((_,i)=>!attached[i]);
  const describeDetached=mesh=>{
    const i=meshes.indexOf(mesh),bounds=boxes[i];
    const distance=box=>Math.hypot(...['x','y','z'].map(axis=>
      Math.max(0,box.min[axis]-bounds.max[axis],bounds.min[axis]-box.max[axis])));
    const nearest=Math.min(...boxes.filter((_,j)=>attached[j]).map(distance));
    return `${mesh.geometry.type} ${JSON.stringify(mesh.geometry.parameters)} `+
      `at ${mesh.getWorldPosition(new THREE.Vector3()).toArray().map(n=>n.toFixed(2))} `+
      `gap ${nearest.toFixed(3)}m ${JSON.stringify(mesh.userData)}`;
  };
  assert.equal(detached.length,0,`Detached meshes in house ${caseIndex}/${detail}: `+
    detached.slice(0,12).map(describeDetached));

  const steps=meshes.filter(mesh=>Number.isInteger(mesh.userData.entranceStep));
  assert.deepEqual(steps.map(mesh=>mesh.userData.entranceStep),[0,1,2],
    `Case ${caseIndex}/${detail} needs three connected entrance steps`);
  assert(steps.every(mesh=>mesh.userData.houseInvariant),
    'Stair geometry must not overlap and flicker during street LOD fading');
  for(let i=1;i<steps.length;i++)assert(touch(
    new THREE.Box3().setFromObject(steps[i-1]),new THREE.Box3().setFromObject(steps[i]),0),
  `Step ${i} floats away from the adjacent riser`);

  const cfg=model.group.userData.config;
  for(const opening of root.children.filter(item=>item.userData.windowStyle)){
    const pane=opening.children.find(child=>child.userData.glassPane);
    if(!pane)continue;
    const bound=new THREE.Box3().setFromObject(pane);
    const side=Math.abs(opening.rotation.y)>1;
    const outside=side?Math.max(Math.abs(bound.min.x),Math.abs(bound.max.x))-cfg.width/2:
      bound.max.z-cfg.depth/2;
    assert(outside<.065&&outside>-.02,
      `Window pane is not flush with ${side?'side':'front'} facade: ${outside}`);
  }
  const frontDoor=root.children.find(child=>child.userData.doorStyle&&!child.userData.balconyDoor);
  const paint=frontDoor.children.find(child=>child.userData.paintedDoorPanel);
  const paintDepth=new THREE.Box3().setFromObject(paint).max.z-cfg.depth/2;
  assert(paintDepth>=0&&paintDepth<.028,`Door painting sits ${paintDepth}m off the wall`);

  if(cfg.balcony&&cfg.floors>1&&detail==='high'){
    const balconyDoor=root.children.find(child=>child.userData.balconyDoor);
    const pane=balconyDoor.children.find(child=>child.userData.glassPane);
    const paneDepth=new THREE.Box3().setFromObject(pane).max.z-cfg.depth/2;
    assert(paneDepth>=0&&paneDepth<.028,'Balcony door glass is not flush');
    if(cfg.doorStyle==='arched')assert(balconyDoor.children.some(child=>child.userData.balconyInnerFrame),
      'Arched balcony door is missing the joined timber arch');
  }
  model.dispose();
}

const varied=createHouseModel(THREE,{...HOUSE_DEFAULTS,floors:4,width:10,frontWindows:5,
  sideWindows:4,balcony:true,windowStyle:'arched',shutters:false});
const variations=[];
varied.group.traverse(mesh=>{
  if(mesh.userData.glassPane)variations.push(mesh.geometry.userData.glassVariation);
});
assert(variations.length>12,'Need a broad sample of window glass surfaces');
assert(variations.every(item=>item&&item.span>=.78&&item.span<=.93),
  'Every painted pane should have a bounded non-repeating crop');
assert(new Set(variations.map(item=>item.turn)).size>=3,
  'Glass paintings need different directions across the house');
assert(new Set(variations.map(item=>`${item.turn}/${item.reflection}/${item.offsetU.toFixed(3)}`)).size>=8,
  'Glass paintings should sample different parts of the same texture');
varied.dispose();
console.log('House geometry: all LOD meshes connected; windows, balcony and entrance contact facade; glass variants and stair treads OK');
