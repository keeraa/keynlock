import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createSpurGear} from '../public/js/lab/geometry/lock-profiles.js';
import {createGearLockMode,GEAR_TRAIN_SPECS} from '../public/js/lab/mechanisms/gear-lock.js';

function build(){
  const root=new THREE.Group(),lockMount=new THREE.Group();
  lockMount.scale.setScalar(.5);lockMount.position.z=.6;root.add(lockMount);
  const make=()=>new THREE.Mesh(new THREE.BoxGeometry(1,1,.08),
    new THREE.MeshStandardMaterial());
  const hardware={rearCover:make(),sideShell:make(),frontBezel:make(),
    shacklePivot:new THREE.Group(),shackleCollars:[new THREE.Group(),new THREE.Group()]};
  hardware.shacklePivot.position.x=1.52;
  const mat={steel:new THREE.MeshStandardMaterial({color:0xa9b9bb,roughness:.6,metalness:.5}),
    brass:new THREE.MeshStandardMaterial({color:0xcab17a,roughness:.65,metalness:.4})};
  const hitObjects=[];
  const gearbox=createGearLockMode({THREE,root,lockMount,hardware,fastenerFixtures:[],
    mat,hitObjects,createSpurGear:(...args)=>createSpurGear(THREE,...args)});
  return {gearbox,hitObjects,root};
}

test('five physically spaced wheels transmit alternating rotation into a bolt and shackle',()=>{
  const {gearbox,hitObjects}=build();
  assert.equal(gearbox.group.visible,false);
  assert.equal(gearbox.wheels.length,5);
  assert.deepEqual(gearbox.wheels.map(wheel=>wheel.spec),GEAR_TRAIN_SPECS,
    'the physical transmission and its printed schematic share wheel dimensions');
  assert.equal(hitObjects.filter(item=>item.userData.kind==='gearWheel').length,5);
  const centers=gearbox.wheels.map(wheel=>wheel.spec);
  for(let i=1;i<centers.length;i++){
    const a=centers[i-1],b=centers[i];
    const pitch=Math.hypot(b.x-a.x,b.y-a.y);
    assert.ok(Math.abs(pitch-a.r-b.r)<.012,
      'the gear teeth sit at each other’s pitch circles without deep overlaps');
  }
  const shackle=gearbox.group.children.find(object=>object.isGroup&&object.position.x===1.52);
  const before=shackle.position.x;
  gearbox.turn(1.8);
  for(let i=0;i<70;i++)gearbox.tick(.05);
  assert.equal(gearbox.state().open,true);
  assert.equal(gearbox.state().progress,100);
  assert.ok(shackle.position.x>before+.45,'gear output actually moves the original-shaped shackle');
  const [a,b,c]=gearbox.wheels;
  assert.ok(a.pivot.rotation.z>0&&b.pivot.rotation.z<0&&c.pivot.rotation.z>0);
  assert.ok(Math.abs(Math.abs((b.pivot.rotation.z-Math.PI/b.spec.teeth)/
    a.pivot.rotation.z)-a.spec.teeth/b.spec.teeth)<.01,
  'meshing wheels use the exact inverse tooth-count ratio');
  gearbox.reset();
  assert.equal(gearbox.state().progress,0);
  assert.equal(shackle.position.x,before);
});

test('oil coats one real wheel once and increases transmission efficiency',()=>{
  const {gearbox}=build();
  assert.equal(gearbox.lubricate(2),true);
  assert.equal(gearbox.lubricate(2),false,'the same wheel is not lubricated twice');
  assert.equal(gearbox.state().lubricated,1);
  assert.ok(gearbox.wheels[2].film?.isMesh);
  assert.ok(gearbox.wheelCenter(2).length()<3);
  gearbox.turn(.5);
  for(let i=0;i<50;i++)gearbox.tick(.05);
  assert.ok(gearbox.state().progress>=40,'lubrication reduces effort');
  gearbox.reset();
  assert.equal(gearbox.state().lubricated,0);
  assert.equal(gearbox.wheels[2].film,null);
});
