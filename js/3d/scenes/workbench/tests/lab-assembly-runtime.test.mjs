import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createLaboratoryLockVisual} from '../public/js/lab-lock-visual.js';

function fakeDocument(){
  const gradient=()=>({addColorStop(){}});
  const context=new Proxy({
    createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
    createLinearGradient:gradient,createRadialGradient:gradient,
    getImageData:(x,y,width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
  },{get(target,key){return key in target?target[key]:()=>{};}});
  return {createElement:()=>({width:0,height:0,getContext:()=>context})};
}

test('real 3D assembly builds with a half-scale lock, two trays and all removable internals',()=>{
  const previousDocument=globalThis.document;
  const previousLoad=THREE.TextureLoader.prototype.load;
  globalThis.document=fakeDocument();
  THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
  const scene=new THREE.Scene(),parent=new THREE.Group();
  parent.position.set(.03,-1.5,-.5);
  parent.rotation.x=-Math.PI/2;parent.scale.set(.64,.8,.256);
  scene.add(parent);
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,8,5);
  const hitObjects=[];
  let lab;
  try{
    lab=createLaboratoryLockVisual(parent,hitObjects,camera);
    const lock=lab.root.children.find(object=>object.isGroup&&object.scale.x===.5);
    assert.ok(lock,'assembled 3D mechanism is scaled down separately from tools');
    const trays=lab.root.children.filter(object=>object.isGroup&&
      object.position.y>1.7&&object.position.x<-3.0);
    assert.equal(trays.length,2);
    assert.equal(Object.keys(lab.portable).length,30,
      'pins, drivers, springs, shackle, retaining clips and housing can detach');
    assert.ok(lab.portable['fastener-0']?.children.length>=2,
      'the original washer and post are one rigid removable assembly');
    assert.match(lab.getAssemblyPartInfo({kind:'internal',id:'fastener-0'}).name,
      /Крепёжная стойка с кольцом/);
    assert.equal(lab.portable['washer-0'],undefined);
    assert.equal(lab.portable['post-0'],undefined);
    assert.ok(lab.portable['shackle-0']);
    assert.ok(lab.portable['clip-0']&&lab.portable['clip-1'],
      'two real cylinder retaining hoops are interactive');
    assert.ok(lab.portable['collar-0']&&lab.portable['collar-1'],
      'shackle sockets are removable after the shackle');
    assert.equal(lab.portable['rear-0'],undefined,
      'rear plate is part of the fixed supporting lock base');
    assert.equal(lab.canDetachPart('rear-0').allowed,false);
    const rearPlate=lock.children.find(child=>child.isMesh&&child.position.z===-.75);
    assert.ok(rearPlate,'fixed rear plate remains in the lock');
    const cap=lab.portable['cover-0'];
    assert.equal(cap.material.transparent,false);
    assert.equal(cap.material.opacity,1,
      'upper strip stays opaque and is identified by its white perimeter');
    assert.equal(lab.getDustiness(),100);
    assert.match(lab.getAssemblyGuidance().title,/Выкрутите винты/);
    assert.ok(Object.values(lab.portable).every(object=>object.visible!==false));
    const rag=lab.root.children.find(object=>object.isGroup&&object.scale.x===2&&
      object.position.x>0);
    const driver=lab.root.children.find(object=>object.isGroup&&object.scale.x===2&&
      object.position.x<0);
    assert.ok(rag&&driver,'both hand-held tools have doubled scale');
    assert.equal(driver.visible,false,'screwdriver is invisible until it is used');
    const gearScene=lab.root.getObjectByName('Шестерёнчатый замок');
    assert.ok(gearScene,'the same housing has a standalone connected gear drive');
    assert.equal(gearScene.visible,false);
    assert.ok(hitObjects.some(mesh=>mesh.userData.kind==='oilCan'),
      'the original leather-and-metal oil can has a usable pickup zone');
    lab.setGearMode(true);
    assert.equal(lock.visible,false,'the disassembly state is preserved in its own instance');
    assert.equal(gearScene.visible,true);
    assert.equal(hitObjects.filter(mesh=>mesh.userData.kind==='gearWheel').length,5);
    assert.equal(lab.oilPart({kind:'gearWheel',index:2}),true);
    assert.equal(lab.getGearState().lubricated,1);
    lab.turnGear(1.4);
    for(let i=0;i<90;i++)lab.updateTools(performance.now()+1100+i*50);
    assert.equal(lab.getGearState().open,true,'the full gear chain opens the padlock');
    lab.resetGear();
    assert.equal(lab.getGearState().progress,0);
    lab.setGearMode(false);
    assert.equal(gearScene.visible,false);
    assert.equal(lock.visible,true);
    assert.ok(Math.abs(driver.rotation.z-Math.PI/2)<1e-10,
      'screwdriver rests tip first toward the far side of the table');
    const installedScrews=hitObjects.filter(mesh=>mesh.userData.kind==='loose'&&
      typeof mesh.userData.index==='number').map(hit=>hit.parent);
    const installedAxes=installedScrews.map(screw=>screw.quaternion.clone());
    const oldHeight=rag.position.z;
    lab.setWiping(true);
    assert.ok(rag.position.z>oldHeight+.4,'rag rises immediately to the lock surface');
    lab.setRagContact(true);
    assert.equal(lab.puffDust({x:.49,y:.52}),true,
      'pressing the cloth against the cover immediately lifts dust');
    assert.ok(lab.root.children.some(object=>object.isPoints),
      'a temporary 3D cloud is attached at the contact point');
    lab.wipeDust({x:.6,y:.6},true);
    lab.setWiping(false);
    const fabric=rag.children.find(child=>child.isMesh&&child.geometry?.attributes?.position?.count>50);
    const frozenFabric=fabric.geometry.attributes.position.array.slice();
    lab.updateTools(performance.now()+400);
    assert.deepEqual(fabric.geometry.attributes.position.array,frozenFabric,
      'released rag retains its settled folds instead of dancing');
    lab.setScrewdriverHeld(true);
    assert.equal(driver.visible,true);
    lab.moveHeldTool(new THREE.Vector3(.75,.60,0));
    lab.updateTools(performance.now()+500);
    driver.updateWorldMatrix(true,false);
    const bit=driver.localToWorld(new THREE.Vector3(1.29,0,0));
    const tipOnTable=lab.root.worldToLocal(bit);
    assert.ok(Math.hypot(tipOnTable.x-.75,tipOnTable.y-.60)<.02,
      'the doubled bit, not the handle, reaches the requested mouse point');
    assert.ok(hitObjects.some(mesh=>mesh.userData.kind==='shackle'));
    assert.ok(hitObjects.some(mesh=>mesh.userData.kind==='internal'));
    for(let index=0;index<4;index++)assert.equal(lab.unscrewCorner(index),true);
    assert.equal(lab.remainingScrews(),0,'all four screws are scheduled for removal');
    lab.stowScrewdriver();
    lab.updateTools(performance.now()+1700);
    assert.equal(lab.removeCover(),'ready',
      'a click alone cannot fling the cover off the lock');
    assert.match(lab.getAssemblyGuidance().title,/Снимите крышку/);
    lab.setHoveredDetachable({kind:'cover'});
    const coverFrame=lab.root.children.find(child=>child.isGroup&&child.scale.x===.5&&
      child.children.some(item=>item.isMesh&&item.geometry?.type==='TubeGeometry'));
    assert.ok(coverFrame?.children.some(child=>child.geometry?.type==='TubeGeometry'&&child.visible),
      'ready-to-remove cover has a pale frame');
    const grab=parent.worldToLocal(coverFrame.getWorldPosition(new THREE.Vector3()));
    assert.equal(lab.beginLooseDrag('cover',grab),true);
    assert.equal(lab.canRemoveCover(),false);
    lab.moveLooseDrag(grab.clone().add(new THREE.Vector3(.1,0,0)));
    assert.ok(coverFrame.position.z+(.685-.024)*.5>=lock.position.z+.78*.5-.025,
      'held cover stays above the lock housing instead of clipping through it');
    lab.moveLooseDrag(grab.clone().add(new THREE.Vector3(1.4,-.5,0)));
    lab.endLooseDrag();
    lab.updateTools(performance.now()+3400);
    assert.equal(lab.getAssemblyGuidance().id,'cover-0');
    lab.setHoveredDetachable({kind:'internal',id:'rear-0'});
    let capHighlighted=false;
    lab.portable['cover-0'].traverse(object=>{
      if(object.userData.hoverGuide&&object.visible)capHighlighted=true;
    });
    assert.equal(capHighlighted,true,'the next removable strip is highlighted instead');
    const gear=lab.portable['gear-0'];
    assert.equal(lab.canDetachPart('gear-0').allowed,false,
      'drive gear is locked until the connecting rod is removed');
    const rod=lab.portable['rod-0'];
    const rodPoint=parent.worldToLocal(rod.getWorldPosition(new THREE.Vector3()));
    assert.equal(lab.beginInternalDrag('rod-0',rodPoint),true);
    lab.endLooseDrag();
    assert.equal(lab.canDetachPart('gear-0').allowed,true);
    for(const id of ['clip-0','clip-1']){
      assert.equal(lab.canDetachPart(id).allowed,true);
      const clip=lab.portable[id];
      assert.match(lab.getAssemblyPartInfo({kind:'internal',id}).name,/Стопорная скоба/);
      const clipPoint=parent.worldToLocal(clip.getWorldPosition(new THREE.Vector3()));
      assert.equal(lab.beginInternalDrag(id,clipPoint),true);
      assert.equal(clip.parent,lab.root,'clip pulls out as a genuine 3D part');
      lab.endLooseDrag();
    }
    assert.equal(lab.canDetachPart('core-0').allowed,true,
      'both retaining clips release the lock cylinder');
    lab.setHoveredDetachable({kind:'internal',id:'gear-0'});
    assert.ok(gear.children.some(child=>child.userData.hoverGuide&&child.visible)||
      gear.children.some(child=>child.children.some(mesh=>mesh.userData.hoverGuide&&mesh.visible)),
      'available internal pieces glow on their own geometry');
    const point=parent.worldToLocal(gear.getWorldPosition(new THREE.Vector3()));
    assert.equal(lab.beginInternalDrag('gear-0',point),true);
    assert.equal(gear.parent,lab.root,'detached gear becomes a real loose item');
    lab.endLooseDrag();
    assert.equal(lab.canDetachPart('shackle-0').allowed,false,
      'an intact locking bolt prevents removing the U-shaped shackle');
    for(const id of ['cam-0','bolt-0']){
      const part=lab.portable[id];
      const partPoint=parent.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
      assert.equal(lab.beginInternalDrag(id,partPoint),true);
      lab.endLooseDrag();
    }
    assert.equal(lab.canDetachPart('shackle-0').allowed,true);
    const shackle=lab.portable['shackle-0'];
    const shacklePoint=parent.worldToLocal(shackle.getWorldPosition(new THREE.Vector3()));
    assert.equal(lab.beginInternalDrag('shackle-0',shacklePoint),true);
    assert.equal(shackle.parent,lab.root,'shackle can be pulled out as a physical part');
    lab.endLooseDrag();
    for(const id of ['collar-0','collar-1']){
      assert.equal(lab.canDetachPart(id).allowed,true);
      const collar=lab.portable[id];
      const collarPoint=parent.worldToLocal(collar.getWorldPosition(new THREE.Vector3()));
      assert.equal(lab.beginInternalDrag(id,collarPoint),true);
      lab.endLooseDrag();
    }
    lab.resetScrews();
    assert.equal(rearPlate.parent,lock,'reset never moves the rear plate');
    assert.notEqual(gear.parent,lab.root,'reset returns the same 3D mesh to its socket');
    installedScrews.forEach((screw,index)=>assert.ok(
      screw.quaternion.angleTo(installedAxes[index])<1e-7,
      'reset restores the original screw axis, not just its head rotation'));
  }finally{
    lab?.dispose();
    THREE.TextureLoader.prototype.load=previousLoad;
    if(previousDocument===undefined)delete globalThis.document;
    else globalThis.document=previousDocument;
  }
});
