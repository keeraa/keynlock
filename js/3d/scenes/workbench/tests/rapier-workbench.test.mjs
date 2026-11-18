import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.js';
import {createRigidWorkbenchPhysics} from '../public/js/lab/physics/rapier-workbench.js';
import {SORTING_TRAY,SECOND_SORTING_TRAY} from '../public/js/lab/physics/workbench-contact.js';

test('Rapier keeps screws in the real tray and places the tray and cover on the table',async()=>{
  const tableSurfaceZ=-.818;
  const tray=new THREE.Group();
  const {width,height,wall,wallHeight,bottomCenter,bottomThickness}=SORTING_TRAY;
  const wallCenterZ=bottomCenter+bottomThickness/2+wallHeight/2-.0075;
  tray.position.set(SORTING_TRAY.x,SORTING_TRAY.y,
    tableSurfaceZ-bottomCenter+bottomThickness/2+.012);
  const screws=[new THREE.Group(),new THREE.Group()];
  screws[0].position.set(SORTING_TRAY.x,SORTING_TRAY.y,1.0);
  screws[1].position.set(SORTING_TRAY.x-.11,SORTING_TRAY.y-.05,1.2);
  const cover=new THREE.Group();
  cover.position.set(2.9,1.5,-.51);cover.rotation.y=.12;
  const physics=createRigidWorkbenchPhysics({screws,tray,cover,tableSurfaceZ,
    tableHalfX:7.1875,tableHalfY:3.92857,tableCenterX:-.0375,
    trayWidth:width,trayHeight:height,wall,wallHeight,wallCenterZ,
    trayBottomCenter:bottomCenter,trayBottomThickness:bottomThickness});
  try{
    assert.equal(await physics.initialized,true);
    for(const index of [0,1])physics.spawnScrew(index,{
      velocity:new THREE.Vector3(),angularVelocity:2,spin:1});
    physics.spawnCover();
    for(let i=0;i<240;i++)physics.step(1/60);

    const trayUnderside=tray.position.z+bottomCenter-bottomThickness/2;
    assert.ok(Math.abs(trayUnderside-tableSurfaceZ)<.025);
    const floor=tray.position.z+bottomCenter+bottomThickness/2;
    for(const screw of screws){
      assert.ok(screw.position.z>floor+.04,'shaft rests above the inner tray floor');
      assert.ok(Math.abs(screw.position.x-tray.position.x)<width/2,'x within tray');
      assert.ok(Math.abs(screw.position.y-tray.position.y)<height/2,'y within tray');
    }
    assert.ok(screws[0].position.distanceTo(screws[1].position)>.10,
      'two screws repel each other instead of occupying the same space');
    const coverUnderside=cover.position.z+.685-.024;
    assert.ok(Math.abs(coverUnderside-tableSurfaceZ)<.04,
      'removed lid rests on the tabletop');

    physics.beginDrag(0);
    screws[0].position.set(5.6,3.2,.58);
    physics.moveDrag(0);
    physics.step(1/60);
    physics.endDrag(0,new THREE.Vector3(.2,0,0));
    for(let i=0;i<200;i++)physics.step(1/60);
    assert.ok(screws[0].position.x>5,'a grabbed screw reaches the far tabletop edge');
    assert.ok(screws[0].position.y>2.7,'the table is no longer limited to the central strip');
    assert.ok(screws[0].position.z>tableSurfaceZ+.045,
      'the dropped screw also collides with the tabletop');
  }finally{physics.dispose();}
});

test('a loose screw topples if it lands balanced on its head',async()=>{
  const tableSurfaceZ=-.818;
  const {width,height,wall,wallHeight,bottomCenter,bottomThickness}=SORTING_TRAY;
  const tray=new THREE.Group();tray.position.set(SORTING_TRAY.x,SORTING_TRAY.y,
    tableSurfaceZ-bottomCenter+bottomThickness/2+.012);
  const screw=new THREE.Group();
  screw.position.set(SORTING_TRAY.x,SORTING_TRAY.y,.2);
  const physics=createRigidWorkbenchPhysics({screws:[screw],tray,cover:new THREE.Group(),
    tableSurfaceZ,tableHalfX:7.1875,tableHalfY:3.92857,tableCenterX:-.0375,
    trayWidth:width,trayHeight:height,wall,wallHeight,
    trayBottomCenter:bottomCenter,trayBottomThickness:bottomThickness});
  try{
    assert.equal(await physics.initialized,true);
    physics.spawnScrew(0,{velocity:new THREE.Vector3(),angularVelocity:0,spin:0});
    for(let i=0;i<360;i++)physics.step(1/60);
    const up=new THREE.Vector3(0,0,1).applyQuaternion(screw.quaternion);
    assert.ok(Math.abs(up.z)<.78,
      `screw should lie sideways (up.z=${up.z.toFixed(3)}, z=${screw.position.z.toFixed(3)})`);
  }finally{physics.dispose();}
});

test('second tray catches screws and pulling a lower screw does not launch its neighbour',async()=>{
  const tableSurfaceZ=-.818;
  const {width,height,wall,wallHeight,bottomCenter,bottomThickness}=SORTING_TRAY;
  const makeTray=config=>{
    const item=new THREE.Group();item.position.set(config.x,config.y,
      tableSurfaceZ-bottomCenter+bottomThickness/2+.012);return item;
  };
  const trays=[makeTray(SORTING_TRAY),makeTray(SECOND_SORTING_TRAY)];
  const screws=[new THREE.Group(),new THREE.Group()];
  screws[0].position.set(SECOND_SORTING_TRAY.x,SECOND_SORTING_TRAY.y,.2);
  screws[1].position.set(SECOND_SORTING_TRAY.x+.04,SECOND_SORTING_TRAY.y,.85);
  const physics=createRigidWorkbenchPhysics({screws,tray:trays[0],trays,
    cover:new THREE.Group(),tableSurfaceZ,
    trayWidth:width,trayHeight:height,wall,wallHeight,
    trayBottomCenter:bottomCenter,trayBottomThickness:bottomThickness,
    screwScaleFactor:.5});
  try{
    assert.equal(await physics.initialized,true);
    for(let index=0;index<2;index++)physics.spawnScrew(index,{velocity:new THREE.Vector3(),
      angularVelocity:0,spin:0});
    for(let i=0;i<100;i++)physics.step(1/60);
    physics.beginDrag(0);
    screws[0].position.set(2.5,0,.45);
    physics.moveDrag(0);
    for(let i=0;i<8;i++)physics.step(1/60);
    assert.ok(Math.abs(screws[1].position.x-SECOND_SORTING_TRAY.x)<.8,
      'upper screw stays in the second tray when the lower screw is picked up');
    physics.endDrag(0,new THREE.Vector3(.1,0,0));
    for(let i=0;i<100;i++)physics.step(1/60);
    assert.ok(Math.abs(screws[1].position.x-SECOND_SORTING_TRAY.x)<.8);
    assert.ok(screws[0].position.x>2);
    for(const item of trays){
      const bottom=item.position.z+bottomCenter-bottomThickness/2;
      assert.ok(Math.abs(bottom-tableSurfaceZ)<.025);
    }
  }finally{physics.dispose();}
});

test('detached real 3D components can be picked up, dropped and settle on the workbench',async()=>{
  const tableSurfaceZ=-.818;
  const tray=new THREE.Group();tray.position.set(SORTING_TRAY.x,SORTING_TRAY.y,
    tableSurfaceZ+.105+.075/2+.012);
  const part=new THREE.Mesh(new THREE.BoxGeometry(.24,.14,.10),
    new THREE.MeshStandardMaterial());
  part.position.set(0,0,.3);
  const physics=createRigidWorkbenchPhysics({screws:[],tray,cover:new THREE.Group(),
    tableSurfaceZ,trayWidth:SORTING_TRAY.width,trayHeight:SORTING_TRAY.height,
    wall:SORTING_TRAY.wall,wallHeight:SORTING_TRAY.wallHeight,
    trayBottomCenter:SORTING_TRAY.bottomCenter,
    trayBottomThickness:SORTING_TRAY.bottomThickness});
  try{
    assert.equal(await physics.initialized,true);
    physics.spawnPart('gear-0',part);
    physics.beginDrag('part:gear-0');
    part.position.set(2.4,-1.2,.2);
    physics.moveDrag('part:gear-0');
    physics.step(1/60);
    physics.endDrag('part:gear-0',new THREE.Vector3());
    for(let i=0;i<100;i++)physics.step(1/60);
    assert.ok(part.position.x>2);
    assert.ok(part.position.z>tableSurfaceZ+.045,
      'the gear has thickness and a live rigid-body collider');
  }finally{physics.dispose();part.geometry.dispose();part.material.dispose();}
});

test('tabletop barriers retain thrown screws, covers and loose parts',async()=>{
  const tableSurfaceZ=-.818,halfX=7.1875,halfY=3.92857;
  const tray=new THREE.Group();
  tray.position.set(SORTING_TRAY.x,SORTING_TRAY.y,
    tableSurfaceZ-SORTING_TRAY.bottomCenter+SORTING_TRAY.bottomThickness/2+.012);
  const screw=new THREE.Group();screw.position.set(6.6,3.34,tableSurfaceZ+.5);
  const cover=new THREE.Group();cover.position.set(-6.2,-2.7,tableSurfaceZ+.8);
  const part=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.22),
    new THREE.MeshStandardMaterial());
  part.position.set(5.9,-3.25,tableSurfaceZ+.5);
  const physics=createRigidWorkbenchPhysics({screws:[screw],tray,cover,
    tableSurfaceZ,tableHalfX:halfX,tableHalfY:halfY,tableCenterX:0,
    trayWidth:SORTING_TRAY.width,trayHeight:SORTING_TRAY.height,
    wall:SORTING_TRAY.wall,wallHeight:SORTING_TRAY.wallHeight,
    trayBottomCenter:SORTING_TRAY.bottomCenter,
    trayBottomThickness:SORTING_TRAY.bottomThickness,
    screwScaleFactor:.5,coverScaleFactor:.5});
  try{
    assert.equal(await physics.initialized,true);
    physics.spawnScrew(0,{velocity:new THREE.Vector3(2,2,.2),
      angularVelocity:0,spin:0});
    physics.spawnCover();physics.spawnPart('loose-gear',part);
    const releases=[
      [0,screw,new THREE.Vector3(5,5,0)],
      ['cover',cover,new THREE.Vector3(-5,-5,0)],
      ['part:loose-gear',part,new THREE.Vector3(5,-5,0)]
    ];
    for(const [id,mesh,velocity] of releases){
      physics.beginDrag(id);physics.moveDrag(id);physics.endDrag(id,velocity);
    }
    for(let i=0;i<330;i++)physics.step(1/60);
    for(const item of [screw,cover,part]){
      assert.ok(Math.abs(item.position.x)<=halfX+.02,
        `item stays within the x extent (${item.position.x})`);
      assert.ok(Math.abs(item.position.y)<=halfY+.02,
        `item stays within the y extent (${item.position.y})`);
      const underside=item===cover?item.position.z+.685*.5-.024*.5:
        item.position.z;
      assert.ok(underside>=tableSurfaceZ-.05,
        `item cannot fall below the table (${underside})`);
    }
  }finally{physics.dispose();part.geometry.dispose();part.material.dispose();}
});

test('removed cover lands on the solid lock housing, never inside its texture',async()=>{
  const tableSurfaceZ=0;
  const tray=new THREE.Group();
  tray.position.set(SORTING_TRAY.x,SORTING_TRAY.y,
    tableSurfaceZ-SORTING_TRAY.bottomCenter+SORTING_TRAY.bottomThickness/2+.012);
  const cover=new THREE.Group();cover.position.set(0,0,1.4);
  const lockBounds={x:0,y:0,halfX:.9,halfY:.68,zTop:.8};
  const physics=createRigidWorkbenchPhysics({screws:[],tray,cover,tableSurfaceZ,
    trayWidth:SORTING_TRAY.width,trayHeight:SORTING_TRAY.height,
    wall:SORTING_TRAY.wall,wallHeight:SORTING_TRAY.wallHeight,
    trayBottomCenter:SORTING_TRAY.bottomCenter,
    trayBottomThickness:SORTING_TRAY.bottomThickness,
    coverScaleFactor:.5,lockBounds});
  try{
    assert.equal(await physics.initialized,true);
    physics.spawnCover();
    for(let i=0;i<260;i++)physics.step(1/60);
    const underside=cover.position.z+(.685-.024)*.5;
    assert.ok(underside>=lockBounds.zTop-.025,
      `physical cover rests above the metal housing (${underside})`);
    assert.ok(underside<lockBounds.zTop+.10,
      'the same cover settles on the housing rather than hovering high above it');
  }finally{physics.dispose();}
});
