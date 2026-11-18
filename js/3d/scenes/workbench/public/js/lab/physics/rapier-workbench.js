// Rigid-body simulation of the workbench's movable hardware. The engine is
// loaded only when the laboratory is constructed, keeping the other modes light.
import * as THREE from '../../../vendor/three.js';
const STEP=1/60;

export function createRigidWorkbenchPhysics({screws,tray,trays=[tray],cover,tableSurfaceZ,
  tableHalfX=7.2,tableHalfY=3.93,tableCenterX=0,
  trayWidth,trayHeight,wall,wallHeight,wallCenterZ,
  trayBottomCenter,trayBottomThickness,screwScaleFactor=1,coverScaleFactor=1,
  lockBounds=null}){
  let RAPIER=null,world=null,coverBody=null,disposed=false;
  let accumulated=0,elapsed=0;
  const screwBodies=new Map();
  const partBodies=new Map(),pendingParts=new Map(),bodyColliders=new Map();
  const pendingScrews=new Map();
  const lastNudged=new Map();
  const dragged=new Set();
  const trayBodies=[];
  let pendingCover=false;
  const actualWallCenterZ=Number.isFinite(wallCenterZ)?wallCenterZ:
    trayBottomCenter+trayBottomThickness/2+wallHeight/2-.0075;
  const trayRests=trays.map(item=>({position:item.position.clone(),quaternion:item.quaternion.clone()}));

  const vec=object=>({x:object.x,y:object.y,z:object.z});
  const quat=object=>({x:object.x,y:object.y,z:object.z,w:object.w});
  const setMeshPose=(mesh,body)=>{
    const p=body.translation(),q=body.rotation();
    mesh.position.set(p.x,p.y,p.z);
    mesh.quaternion.set(q.x,q.y,q.z,q.w);
  };
  function createScrew(index,legacy){
    if(!world||screwBodies.has(index))return;
    const screw=screws[index];
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...screw.position.toArray())
      .setRotation(quat(screw.quaternion))
      .setLinearDamping(.78).setAngularDamping(1.3).setCcdEnabled(true));
    // The shaft and slotted head are part of one rigid body. Each can hit the
    // floor, other screws and all four tray walls.
    const vertical={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2};
    const colliders=[
      world.createCollider(RAPIER.ColliderDesc.cylinder(.392*screwScaleFactor,.051*screwScaleFactor)
        .setTranslation(0,0,-.322*screwScaleFactor).setRotation(vertical)
        .setFriction(.78).setRestitution(.12).setDensity(3),body),
      world.createCollider(RAPIER.ColliderDesc.cylinder(.033*screwScaleFactor,.091*screwScaleFactor)
        .setTranslation(0,0,.055*screwScaleFactor).setRotation(vertical)
        .setFriction(.78).setRestitution(.12).setDensity(3),body)
    ];
    bodyColliders.set(index,colliders);
    if(legacy){
      body.setLinvel(vec(legacy.velocity),true);
      const a=legacy.angularVelocity||0;
      body.setAngvel({x:a,y:(legacy.spin||0),z:a*.25},true);
    }
    if(dragged.has(index)){
      body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
      body.setNextKinematicTranslation(vec(screw.position));
      colliders.forEach(collider=>collider.setEnabled(false));
    }
    screwBodies.set(index,body);
  }

  function createCover(){
    if(!world||coverBody)return;
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...cover.position.toArray())
      .setRotation(quat(cover.quaternion))
      .setLinearDamping(1.4).setAngularDamping(2.8).setCcdEnabled(true));
    const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(
      1.64*coverScaleFactor,1.19*coverScaleFactor,.024*coverScaleFactor)
      .setTranslation(0,0,.685*coverScaleFactor).setFriction(.95)
      .setRestitution(.04).setDensity(1.4),body);
    bodyColliders.set('cover',[collider]);
    coverBody=body;
    if(dragged.has('cover')){
      coverBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
      coverBody.setNextKinematicTranslation(vec(cover.position));
      collider.setEnabled(false);
    }
  }

  // Detachable components are the real volumetric meshes from the pin lab.
  // Their rigid bodies use collision proxies derived from that same geometry.
  function createPart(id,object){
    if(!world||partBodies.has(id))return;
    object.updateWorldMatrix(true,true);
    const inverse=object.matrixWorld.clone().invert();
    const bounds=new THREE.Box3().makeEmpty();
    object.traverse(child=>{
      if(!child.isMesh||!child.geometry)return;
      if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();
      if(child.geometry.boundingBox){
        const relative=inverse.clone().multiply(child.matrixWorld);
        bounds.union(child.geometry.boundingBox.clone().applyMatrix4(relative));
      }
    });
    if(bounds.isEmpty())bounds.setFromCenterAndSize(
      new THREE.Vector3(),new THREE.Vector3(.1,.1,.1));
    const size=bounds.getSize(new THREE.Vector3()).multiply(object.scale);
    const center=bounds.getCenter(new THREE.Vector3()).multiply(object.scale);
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...object.position.toArray()).setRotation(quat(object.quaternion))
      .setLinearDamping(1.2).setAngularDamping(2.2).setCcdEnabled(true));
    const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(
      Math.max(.018,Math.abs(size.x)/2),Math.max(.018,Math.abs(size.y)/2),
      Math.max(.018,Math.abs(size.z)/2))
      .setTranslation(center.x,center.y,center.z).setFriction(.84)
      .setRestitution(.025).setDensity(2),body);
    const key=`part:${id}`;
    bodyColliders.set(key,[collider]);partBodies.set(id,body);
    if(dragged.has(key)){
      body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
      body.setNextKinematicTranslation(vec(object.position));collider.setEnabled(false);
    }
  }

  const initialized=import('../../../vendor/rapier.mjs').then(async module=>{
    RAPIER=module;
    await RAPIER.init();
    if(disposed)return;
    world=new RAPIER.World({x:0,y:0,z:-6.7});
    world.timestep=STEP;
    const table=world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
      .setTranslation(tableCenterX,0,tableSurfaceZ-.30));
    world.createCollider(RAPIER.ColliderDesc.cuboid(tableHalfX,tableHalfY,.30)
      .setFriction(1.0).setRestitution(.04),table);
    if(lockBounds){
      // The installed housing is an immovable solid. Dynamic covers, screws,
      // pins and the shackle cannot fall through its visible metal surfaces.
      const halfDepth=(lockBounds.zTop-tableSurfaceZ)/2;
      const housing=world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
        .setTranslation(lockBounds.x,lockBounds.y,tableSurfaceZ+halfDepth));
      world.createCollider(RAPIER.ColliderDesc.cuboid(
        lockBounds.halfX,lockBounds.halfY,halfDepth)
        .setFriction(.94).setRestitution(.015),housing);
    }
    // Invisible four-sided rim: thrown screws, covers and detached components
    // stay within the table instead of dropping out of the playable world.
    const rim=world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
      .setTranslation(tableCenterX,0,tableSurfaceZ+1.95));
    for(const sign of [-1,1]){
      world.createCollider(RAPIER.ColliderDesc.cuboid(.10,tableHalfY,2.05)
        .setTranslation(sign*(tableHalfX-.045),0,0)
        .setFriction(.85).setRestitution(.02),rim);
      world.createCollider(RAPIER.ColliderDesc.cuboid(tableHalfX,.10,2.05)
        .setTranslation(0,sign*(tableHalfY-.045),0)
        .setFriction(.85).setRestitution(.02),rim);
    }

    for(const item of trays){
      const trayBody=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...item.position.toArray())
        .setRotation(quat(item.quaternion))
        .setLinearDamping(2.8).setAngularDamping(4.5).setCcdEnabled(true));
      trayBodies.push(trayBody);
      world.createCollider(RAPIER.ColliderDesc.cuboid(trayWidth/2,trayHeight/2,
        trayBottomThickness/2).setTranslation(0,0,trayBottomCenter)
        .setFriction(.95).setRestitution(.035).setDensity(13),trayBody);
      for(const side of [-1,1]){
        world.createCollider(RAPIER.ColliderDesc.cuboid(trayWidth/2,wall/2,wallHeight/2)
          .setTranslation(0,side*(trayHeight-wall)/2,actualWallCenterZ)
          .setFriction(.85).setRestitution(.05).setDensity(13),trayBody);
        world.createCollider(RAPIER.ColliderDesc.cuboid(wall/2,trayHeight/2,wallHeight/2)
          .setTranslation(side*(trayWidth-wall)/2,0,actualWallCenterZ)
          .setFriction(.85).setRestitution(.05).setDensity(13),trayBody);
      }
    }
    for(const [index,legacy] of pendingScrews)createScrew(index,legacy);
    if(pendingCover)createCover();
    for(const [id,object] of pendingParts)createPart(id,object);
    return true;
  }).catch(error=>{
    console.warn('Rigid workbench unavailable; using geometric fallback.',error);
    return false;
  });

  function step(dt){
    if(!world)return;
    accumulated=Math.min(.12,accumulated+Math.max(0,dt));
    while(accumulated>=STEP){
      world.step();accumulated-=STEP;elapsed+=STEP;
      for(const [index,body] of screwBodies){
        if(dragged.has(index))continue;
        const q=body.rotation(),vertical=1-2*(q.x*q.x+q.y*q.y);
        const lv=body.linvel(),av=body.angvel();
        const atRest=body.isSleeping()||(
          Math.hypot(lv.x,lv.y,lv.z)<.08&&Math.hypot(av.x,av.y,av.z)<.25);
        if(Math.abs(vertical)>.78&&body.translation().z<tableSurfaceZ+1.1&&
          atRest&&elapsed-(lastNudged.get(index)??-Infinity)>1){
          // A screw balanced on its head needs a small tip-over impulse only
          // after it stops. Falling or rolling screws remain fully physical.
          body.applyTorqueImpulse({x:index%2===0?.003:-.003,y:.002,z:0},true);
          lastNudged.set(index,elapsed);
        }
      }
    }
    trays.forEach((item,index)=>setMeshPose(item,trayBodies[index]));
    for(const [index,body] of screwBodies){
      if(!dragged.has(index))setMeshPose(screws[index],body);
    }
    if(coverBody&&!dragged.has('cover'))setMeshPose(cover,coverBody);
    for(const [id,body] of partBodies){
      if(!dragged.has(`part:${id}`))setMeshPose(pendingParts.get(id),body);
    }
  }

  function spawnScrew(index,legacy){
    pendingScrews.set(index,legacy);
    createScrew(index,legacy);
  }
  function spawnCover(){pendingCover=true;createCover();}
  function spawnPart(id,object){pendingParts.set(id,object);createPart(id,object);}
  const bodyFor=id=>id==='cover'?coverBody:
    typeof id==='string'&&id.startsWith('part:')?partBodies.get(id.slice(5)):screwBodies.get(id);
  const meshFor=id=>id==='cover'?cover:
    typeof id==='string'&&id.startsWith('part:')?pendingParts.get(id.slice(5)):screws[id];
  function beginDrag(id){
    dragged.add(id);
    const body=bodyFor(id);
    if(!body)return;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    body.setLinvel({x:0,y:0,z:0},true);
    body.setAngvel({x:0,y:0,z:0},true);
    // The held part temporarily ignores contacts; sliding a lower screw out
    // from under another cannot hurl the upper screw across the tabletop.
    bodyColliders.get(id)?.forEach(collider=>collider.setEnabled(false));
  }
  function moveDrag(id){
    const body=bodyFor(id),mesh=meshFor(id);
    if(body&&mesh){
      body.setNextKinematicTranslation(vec(mesh.position));
      body.setNextKinematicRotation(quat(mesh.quaternion));
    }
  }
  function endDrag(id,velocity){
    dragged.delete(id);
    const body=bodyFor(id);
    if(!body)return;
    const mesh=meshFor(id);
    body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    body.setTranslation(vec(mesh.position),true);
    body.setRotation(quat(mesh.quaternion),true);
    body.setLinvel({x:Math.max(-.6,Math.min(.6,velocity.x)),
      y:Math.max(-.6,Math.min(.6,velocity.y)),z:-.12},true);
    body.setAngvel({x:0,y:0,z:0},true);
    bodyColliders.get(id)?.forEach(collider=>collider.setEnabled(true));
    body.wakeUp();
  }
  function removeCover(){
    pendingCover=false;dragged.delete('cover');
    if(coverBody){world.removeRigidBody(coverBody);coverBody=null;}
    bodyColliders.delete('cover');
  }
  function removePart(id){
    pendingParts.delete(id);dragged.delete(`part:${id}`);
    if(partBodies.has(id)){world.removeRigidBody(partBodies.get(id));partBodies.delete(id);}
    bodyColliders.delete(`part:${id}`);
  }
  function reset(){
    pendingScrews.clear();lastNudged.clear();dragged.clear();removeCover();
    for(const id of [...pendingParts.keys()])removePart(id);
    if(!world)return;
    for(const body of screwBodies.values())world.removeRigidBody(body);
    screwBodies.clear();bodyColliders.clear();
    trays.forEach((item,index)=>{
      const body=trayBodies[index],rest=trayRests[index];
      body.setTranslation(vec(rest.position),true);
      body.setRotation(quat(rest.quaternion),true);
      body.setLinvel({x:0,y:0,z:0},true);
      body.setAngvel({x:0,y:0,z:0},true);
      item.position.copy(rest.position);item.quaternion.copy(rest.quaternion);
    });
  }
  function dispose(){disposed=true;if(world){world.free();world=null;}}
  return {get ready(){return Boolean(world);},initialized,spawnScrew,spawnCover,
    spawnPart,removePart,beginDrag,moveDrag,endDrag,removeCover,reset,step,dispose};
}
