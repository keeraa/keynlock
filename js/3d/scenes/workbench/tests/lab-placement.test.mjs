import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {WORKBENCH_TOP_Y,WORKBENCH_WIDTH,WORKBENCH_DEPTH} from '../public/js/workshop-room.js';
import {screwSupportHeight,stepLooseScrews} from '../public/js/lab/physics/loose-parts.js';
import {createTrayContact,screwdriverDockPose,screwdriverGripAngle,
  screwdriverHandleForTip,SORTING_TRAY,SECOND_SORTING_TRAY,
  createWorkbenchContact} from '../public/js/lab/physics/workbench-contact.js';
import {ASSEMBLY_TILT_RADIANS,assemblyOverheadPosition} from '../public/js/workshop-camera.js';

test('lock rear and tray underside stay above the real tabletop',()=>{
  const parent=new THREE.Group();
  parent.position.set(.03,-1.5,-.5);
  parent.rotation.x=-Math.PI/2;
  parent.scale.set(.64,.8,.256);
  const lock=new THREE.Group();lock.position.z=1.05;
  lock.scale.set(1.25,1.05,2);
  parent.add(lock);lock.updateWorldMatrix(true,false);
  const surfaceZ=lock.worldToLocal(new THREE.Vector3(0,WORKBENCH_TOP_Y,0)).z;
  const trayZ=surfaceZ+.105+.075/2+.012;
  const caseBottom=lock.localToWorld(new THREE.Vector3(0,0,-.76)).y;
  const trayBottom=lock.localToWorld(new THREE.Vector3(SORTING_TRAY.x,SORTING_TRAY.y,
    trayZ-.105-.075/2)).y;
  assert.ok(caseBottom>=WORKBENCH_TOP_Y);
  assert.ok(caseBottom-WORKBENCH_TOP_Y<.06);
  assert.ok(trayBottom>=WORKBENCH_TOP_Y);
  assert.ok(trayBottom-WORKBENCH_TOP_Y<.02);
});

test('upright and tilted screws stop on the tray floor',()=>{
  const screw={position:new THREE.Vector3(-3.04,1.5,-1),
    rotation:new THREE.Euler(0,0,0)};
  const bodies=new Map([[0,{sleeping:false,inTray:true,
    velocity:new THREE.Vector3(0,0,-1),angularVelocity:0,spin:0,angle:0}]]);
  const trayContact=createTrayContact({x:-3.04,y:1.5,width:1.07,height:.76,wall:.08});
  const args={screws:[screw],bodies,dt:1/60,trayContact,
    onTray:trayContact.contains,isDragging:()=>false,
    tableSurfaceZ:-.818,traySurfaceZ:-.727,trayRimZ:-.36};
  stepLooseScrews(args);
  assert.ok(screw.position.z>=args.traySurfaceZ+screwSupportHeight(screw.rotation));
  screw.rotation.x=Math.PI/2;screw.position.z=-1;
  stepLooseScrews(args);
  assert.ok(screw.position.z>=args.traySurfaceZ+screwSupportHeight(screw.rotation));
});

test('screwdriver bit points down and meets the screw head',()=>{
  const screw={x:1.57,y:1.09,z:.72};
  const pose=screwdriverDockPose(screw);
  const tip=new THREE.Vector3(1.29,0,0)
    .applyAxisAngle(new THREE.Vector3(0,1,0),pose.rotationY)
    .add(new THREE.Vector3(pose.x,pose.y,pose.z));
  assert.ok(pose.z>tip.z);
  assert.ok(Math.abs(tip.z-(screw.z+.096))<1e-8);
  assert.ok(Math.abs(tip.x-screw.x)<1e-8);
  assert.ok(Math.abs(tip.y-screw.y)<1e-8);
});

test('hand-held screwdriver points its handle toward the camera from every side',()=>{
  const tool=new THREE.Vector3(-2.5,-1.5,.4);
  for(const camera of [new THREE.Vector3(-2.5,-7,5),
    new THREE.Vector3(5,-1.5,4),new THREE.Vector3(-8,4,6)]){
    const angle=screwdriverGripAngle(tool,camera);
    const bit=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0);
    const towardViewer=new THREE.Vector3().subVectors(camera,tool).setZ(0).normalize();
    assert.ok(bit.dot(towardViewer)<-.99999);
  }
});

test('an enlarged screwdriver bit stays under the cursor in any camera direction',()=>{
  const length=1.29*2;
  for(const camera of [{x:-5,y:-5},{x:4,y:8},{x:0,y:0}]){
    for(const tip of [{x:1,y:1},{x:-2,y:3},{x:5,y:-2}]){
      const grip=screwdriverHandleForTip(tip,camera,length);
      const targetX=grip.x+Math.cos(grip.angle)*length;
      const targetY=grip.y+Math.sin(grip.angle)*length;
      assert.ok(Math.hypot(targetX-tip.x,targetY-tip.y)<1e-9);
    }
  }
});

test('half-sized lock contact heights follow its body instead of the old bounds',()=>{
  const surface=-.818,top=surface+.79;
  const contact=createWorkbenchContact({screws:[],isCoverAttached:()=>true,
    tableSurfaceZ:surface,lockScale:.5,lockTopZ:top});
  assert.equal(contact.surfaceAt(0,0),top);
  assert.equal(contact.surfaceAt(1.1,0),surface+.11);
});

test('sorting tray is 50% wider and longer, twice as deep, with half-width walls',()=>{
  assert.equal(SORTING_TRAY.width,1.07*1.5);
  assert.equal(SORTING_TRAY.height,.76*1.5);
  assert.equal(SORTING_TRAY.wall,.09/2);
  assert.equal(SORTING_TRAY.wallHeight,.37*2);
  assert.equal(SECOND_SORTING_TRAY.width,SORTING_TRAY.width);
  assert.ok(SECOND_SORTING_TRAY.x-SORTING_TRAY.x>SORTING_TRAY.width,
    'two trays fit side by side without overlapping');
});

test('the fixed assembly overview has a 20-degree tilt and spans the tabletop',()=>{
  const target=new THREE.Vector3(.55,-1.5,-.5);
  const camera=assemblyOverheadPosition(THREE,target);
  const offset=camera.clone().sub(target).normalize();
  assert.ok(Math.abs(camera.distanceTo(target)-11.5)<1e-10);
  assert.ok(Math.abs(Math.acos(offset.y)-ASSEMBLY_TILT_RADIANS)<1e-10);
  assert.ok(offset.z>0,'camera sees the far edge recede');
  assert.equal(WORKBENCH_WIDTH,11.5);
  assert.equal(WORKBENCH_DEPTH,6.6);
  const pan=new THREE.Vector3(1.4,0,-1.1);
  assert.ok(assemblyOverheadPosition(THREE,target.clone().add(pan))
    .sub(camera).distanceTo(pan)<1e-10,
  'fixed 20-degree view follows a translated target without snapping back');
});
