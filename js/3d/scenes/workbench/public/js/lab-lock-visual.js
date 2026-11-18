import * as THREE from '../vendor/three.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';
import {createGeometryPrimitives} from './lab/geometry/primitives.js';
import {createHousingGeometries} from './lab/geometry/housing.js';
import {createKeyGeometry} from './lab/geometry/key.js';
import {createSpurGear} from './lab/geometry/lock-profiles.js';
import {createLockMaterials} from './lab/effects/lock-materials.js';
import {createPaintedMaterials} from './lab/effects/painted-materials.js';
import {createClothSimulation} from './lab/effects/cloth-simulation.js';
import {createClothTexture} from './lab/effects/cloth-texture.js';
import {createDustCleaningBrush} from './lab/effects/dust-cleaning.js';
import {createDustParticles} from './lab/effects/dust-particles.js';
import {createAssemblyHover} from './lab/effects/assembly-hover.js';
import {createWorkbenchContact,createTrayContact,screwdriverDockPose,
  screwdriverGripAngle,screwdriverHandleForTip,SORTING_TRAY,
  SECOND_SORTING_TRAY} from './lab/physics/workbench-contact.js';
import {createDragController} from './lab/physics/drag-controller.js';
import {stepLooseScrews,stepLooseCover} from './lab/physics/loose-parts.js';
import {createRigidWorkbenchPhysics} from './lab/physics/rapier-workbench.js';
import {WORKBENCH_TOP_Y,WORKBENCH_WIDTH,WORKBENCH_DEPTH} from './workshop-room.js';
import {createLockHardware} from './lab/mechanisms/lock-hardware.js';
import {disassemblyBlocker,nextDisassemblyStep} from './lab/mechanisms/disassembly-order.js';
import {buildPinMechanism} from './lab/mechanisms/pin-lock.js';
import {createGearLockMode} from './lab/mechanisms/gear-lock.js';
import {createWorkbenchOiler} from './lab/tools/oil-can.js';

// Mount the actual pin-laboratory factories into the horizontal workbench.
// Geometry and the original painted material pipeline stay in their own modules.
export function createLaboratoryLockVisual(parent,hitObjects=[],camera){
  // The workbench assembly flattens its depth to 0.256. Compensate here so
  // the lock housing, open tray and tools retain physical height in world space.
  const root=new THREE.Group();root.scale.set(1.25,1.05,2.0);
  // The rear shell begins at local z=-.76. Its lowest metal face rests just
  // above the actual workshop tabletop after both parent transforms.
  root.position.z=1.05;parent.add(root);
  root.updateWorldMatrix(true,false);
  const tableSurfaceZ=root.worldToLocal(new THREE.Vector3(0,WORKBENCH_TOP_Y,0)).z;
  // Scale only the assembled lock. Tools and sorting trays retain their own
  // useful working dimensions, and the smaller housing still sits on the table.
  const lockScale=.5;
  const lockMount=new THREE.Group();lockMount.scale.setScalar(lockScale);
  lockMount.position.z=tableSurfaceZ+.40;root.add(lockMount);
  const lockTopZ=lockMount.position.z+.78*lockScale;
  const lockBounds={x:lockMount.position.x,y:lockMount.position.y,
    halfX:1.78*lockScale,halfY:1.35*lockScale,zTop:lockTopZ-.015};
  const supportSurfaceAt=(x,y,halfX=0,halfY=halfX)=>
    Math.abs(x-lockBounds.x)<lockBounds.halfX+halfX&&
    Math.abs(y-lockBounds.y)<lockBounds.halfY+halfY?
      lockBounds.zTop:tableSurfaceZ;
  const depthRatio=.70,coreCenterY=-.43,coreCenterZ=-.05;
  let seed=0x713b9ada;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const {grainMap,material,mat}=createLockMaterials({THREE,document,rand});
  const parts=[],raycastables=[];
  const tag=(object,name,description='')=>{object.userData.partName=name;
    object.userData.partDescription=description;raycastables.push(object);return object;};
  const part=(object,dir,distance=1)=>{parts.push({obj:object,base:object.position.clone(),
    dir:new THREE.Vector3(...dir).normalize(),distance});return object;};
  const addMesh=(parent,geometry,material,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const primitives=createGeometryPrimitives({THREE,RoundedBoxGeometry,addMesh,
    setDynamicBase:(object,x,y,z)=>{object.userData.dynamicBase=new THREE.Vector3(x,y,z);},
    springMaterial:mat.spring});
  const {box,cyl,ring,rod,makeSpring,capsulePin,driverPin}=primitives;
  const geometry=createHousingGeometries({THREE,depthRatio});
  const hardware=createLockHardware({THREE,document,root:lockMount,depthRatio,coreCenterY,coreCenterZ,
    mat,addMesh,tag,part,parts,raycastables,
    setDynamicBase:(object,x,y,z)=>{object.userData.dynamicBase=new THREE.Vector3(x,y,z);},
    box,cyl,ring,rod,...geometry});
  const shackleRest=hardware.shacklePivot.position.clone();
  const shackleMesh=hardware.shacklePivot.children.find(child=>child.isMesh);
  if(shackleMesh){
    shackleMesh.userData.kind='shackle';
  }
  let shackleHeld=false,shackleShake=0,shacklePullDistance=0;
  function setShacklePull(next,travel=0){
    shackleHeld=Boolean(next);
    if(shackleHeld)shacklePullDistance=Math.min(1,shacklePullDistance+Math.abs(travel)*.016+.12);
    return shackleHeld;
  }
  const screws=parts.filter(entry=>entry.obj.userData.unscrew).map(entry=>entry.obj);
  const screwAnimations=new Map();
  const looseScrewBodies=new Map();
  const looseHits=[];
  lockMount.updateWorldMatrix(true,true);
  screws.forEach((screw,index)=>{
    // A removed screw has to be a free body in tabletop coordinates. Keep its
    // precise installed world position when taking it out of the scaled lock.
    screw.scale.set(.58,.58,.5);
    root.attach(screw);
    // The geometric ray target is intentionally wider than the visible head.
    const hit=new THREE.Mesh(new THREE.CylinderGeometry(.185,.185,.13,24),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    hit.rotation.x=Math.PI/2;
    hit.position.set(screw.position.x,screw.position.y,screw.position.z+.05);
    hit.userData={kind:'screw',index};root.add(hit);hitObjects.push(hit);
    screw.userData.originalPosition=screw.position.clone();
    screw.userData.originalQuaternion=screw.quaternion.clone();
    screw.userData.hitVolume=hit;
    // Pick the complete shaft: tip, thread and head all carry the exact same
    // rigid transform and can be grabbed at their own contact point.
    const looseHit=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.60,12),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    looseHit.rotation.x=Math.PI/2;
    looseHit.position.z=-.62;
    looseHit.userData={kind:'loose',index};looseHit.visible=false;
    screw.add(looseHit);hitObjects.push(looseHit);looseHits.push(looseHit);
  });
  // Two deep steel sorting trays; neither casts the unnatural sharp wall-sized
  // rectangle that was visible behind the old single tray.
  const {width:trayWidth,height:trayHeight,wall,wallHeight,
    bottomCenter:trayBottomCenter,bottomThickness:trayBottomThickness}=SORTING_TRAY;
  const wallCenterZ=trayBottomCenter+trayBottomThickness/2+wallHeight/2-.0075;
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
  const shadowContext=shadowCanvas.getContext('2d');
  const shadowGradient=shadowContext.createRadialGradient(64,64,12,64,64,64);
  shadowGradient.addColorStop(0,'rgba(16,12,11,.24)');
  shadowGradient.addColorStop(.74,'rgba(16,12,11,.12)');
  shadowGradient.addColorStop(1,'rgba(16,12,11,0)');
  shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,128,128);
  const trayShadowMap=new THREE.CanvasTexture(shadowCanvas);
  function makeTray(config){
    const item=new THREE.Group();item.position.set(config.x,config.y,
      tableSurfaceZ-trayBottomCenter+trayBottomThickness/2+.012);root.add(item);
    const makeWall=(geometry,position,material)=>{
      const mesh=addMesh(item,geometry,material,position);mesh.castShadow=false;
      return mesh;
    };
    makeWall(new RoundedBoxGeometry(trayWidth,trayHeight,trayBottomThickness,3,.035),
      [0,0,trayBottomCenter],mat.dark);
    for(const side of [-1,1])makeWall(
      new RoundedBoxGeometry(trayWidth,wall,wallHeight,2,.016),
      [0,side*(trayHeight-wall)/2,wallCenterZ],mat.edge);
    for(const side of [-1,1])makeWall(
      new RoundedBoxGeometry(wall,trayHeight,wallHeight,2,.016),
      [side*(trayWidth-wall)/2,0,wallCenterZ],mat.edge);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(trayWidth*1.22,trayHeight*1.30),
      new THREE.MeshBasicMaterial({map:trayShadowMap,transparent:true,depthWrite:false}));
    shadow.position.set(config.x,config.y,tableSurfaceZ+.016);
    shadow.castShadow=false;shadow.receiveShadow=false;root.add(shadow);
    return item;
  }
  const trays=[SORTING_TRAY,SECOND_SORTING_TRAY].map(makeTray);
  const tray=trays[0];
  const traySurfaceZ=tray.position.z+trayBottomCenter+trayBottomThickness/2;
  const trayRimZ=tray.position.z+wallCenterZ+wallHeight/2;
  const trayContacts=trays.map(item=>createTrayContact({x:item.position.x,y:item.position.y,
    width:trayWidth,height:trayHeight,wall}));
  const trayContact=trayContacts[0];
  const onTray=(x,y)=>trayContacts.some(contact=>contact.contains(x,y));
  const tableHalfX=WORKBENCH_WIDTH/(2*parent.scale.x*root.scale.x);
  const tableHalfY=WORKBENCH_DEPTH/(2*parent.scale.y*root.scale.y);
  const tableCenterX=-parent.position.x/(parent.scale.x*root.scale.x);
  const dropBounds={x:[tableCenterX-tableHalfX+.12,tableCenterX+tableHalfX-.12],
    y:[-tableHalfY+.12,tableHalfY-.12]};
  const pointerInRoot=point=>new THREE.Vector3(
    (point.x-root.position.x)/root.scale.x,
    (point.y-root.position.y)/root.scale.y,
    (point.z-root.position.z)/root.scale.z);
  let coverLooseBody=null;
  let dragContactWorldY=null;
  const drag=createDragController({THREE,toLocal:pointerInRoot,
    bounds:dropBounds,
    onMove:({data})=>{if(physics.ready){physics.moveDrag(data.id);return;}
      if(data.id!=='cover'){
      const body=looseScrewBodies.get(data.id);if(body)body.sleeping=true;
    }},
    onRelease:({object,data,velocity})=>{
      if(data.id==='cover')coverLooseBody={velocity:velocity.clone(),sleeping:false};
      else{const body=looseScrewBodies.get(data.id);
        if(body){body.velocity.copy(velocity);body.velocity.z=-.25;body.sleeping=false;
          // A screw lifted out of the tray is free to land on the table again.
          body.inTray=onTray(object.position.x,object.position.y);}}
      physics.endDrag(data.id,velocity);
    }});
  const dragBounds=new THREE.Box3();
  const dragMatrix=new THREE.Matrix4();
  function movableClearance(object){
    object.updateWorldMatrix(true,true);
    root.updateWorldMatrix(true,false);
    const inverseRoot=root.matrixWorld.clone().invert();
    dragBounds.makeEmpty();
    object.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.geometry||
        ['loose','cover','dust','screw'].includes(mesh.userData.kind)||
        mesh.userData.hoverGuide)return;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      dragMatrix.multiplyMatrices(inverseRoot,mesh.matrixWorld);
      dragBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(dragMatrix));
    });
    if(dragBounds.isEmpty())dragBounds.setFromCenterAndSize(object.position,
      new THREE.Vector3(.16,.16,.1));
    const relative={left:dragBounds.min.x-object.position.x,
      right:dragBounds.max.x-object.position.x,
      bottom:dragBounds.min.z-object.position.z,
      near:dragBounds.min.y-object.position.y,
      far:dragBounds.max.y-object.position.y};
    return (x,y)=>{
      const halfX=(relative.right-relative.left)/2;
      const halfY=(relative.far-relative.near)/2;
      const cx=x+(relative.right+relative.left)/2;
      const cy=y+(relative.near+relative.far)/2;
      return supportSurfaceAt(cx,cy,halfX,halfY)-relative.bottom+.022;
    };
  }
  function beginLooseDrag(index,point){
    if(index==='cover'&&!coverRemoved){
      if(!canRemoveCover())return false;
      // Detach only when the player actually starts dragging. The plate
      // remains under their pointer until they choose a free tabletop spot.
      coverRemoved=true;coverHit.visible=false;coverLooseHit.visible=true;
      coverLooseBody={velocity:new THREE.Vector3(),sleeping:false};
      physics.spawnCover();
      for(const meshes of pickSurfaces.values())
        for(const mesh of meshes)mesh.userData.pickable=true;
    }
    if(index!=='cover'&&typeof index==='number'&&!screws[index]?.userData.removed)return false;
    if(typeof index==='string'&&index.startsWith('part:')&&!detachedParts.has(index.slice(5)))return false;
    const object=index==='cover'?frontCover:
      typeof index==='string'?portable[index.slice(5)]:screws[index];
    if(!object)return false;
    const minimumZAt=movableClearance(object);
    physics.beginDrag(index);
    const source=point?pointerInRoot(point):object.position;
    const worldPoint=source.clone();root.localToWorld(worldPoint);
    dragContactWorldY=worldPoint.y;
    const springExtract=typeof index==='string'&&/^part:spring-\d+$/.test(index)?{
      axis:new THREE.Vector3(0,1,0),distance:.64,duration:.55,
      exitZ:minimumZAt(object.position.x,object.position.y)+.045
    }:null;
    return drag.begin(object,point,{id:index,minimumZ:tableSurfaceZ+.025,
      minimumZAt,smoothTime:(index==='cover'||typeof index==='string')?0.20:0,
      extraction:springExtract});
  }
  const moveLooseDrag=point=>drag.move(point);
  const endLooseDrag=()=>{dragContactWorldY=null;
    const ended=drag.end();setHoveredDetachable(null);return ended;};
  let rotatingLoose=null;
  const verticalAxis=new THREE.Vector3(0,0,1);
  const sideAxis=new THREE.Vector3(1,0,0);
  function beginObjectRotation(hit){
    if(hit?.kind!=='loose'||rotatingLoose)return false;
    const id=hit.index;
    const object=id==='cover'?coverRemoved?frontCover:null:
      typeof id==='number'?screws[id]?.userData.removed?screws[id]:null:
      typeof id==='string'&&id.startsWith('part:')?
        detachedParts.has(id.slice(5))?portable[id.slice(5)]:null:null;
    if(!object)return false;
    rotatingLoose={id,object};
    physics.beginDrag(id);
    return true;
  }
  function rotateObject(dx,dy){
    if(!rotatingLoose)return false;
    const {id,object}=rotatingLoose;
    const yaw=new THREE.Quaternion().setFromAxisAngle(verticalAxis,dx*.010);
    const pitch=new THREE.Quaternion().setFromAxisAngle(sideAxis,-dy*.008);
    object.quaternion.premultiply(yaw).multiply(pitch).normalize();
    const clearance=movableClearance(object);
    object.position.z=Math.max(object.position.z,
      clearance(object.position.x,object.position.y));
    physics.moveDrag(id);
    return true;
  }
  function endObjectRotation(){
    if(!rotatingLoose)return false;
    physics.endDrag(rotatingLoose.id,new THREE.Vector3());
    rotatingLoose=null;
    return true;
  }
  // The original pin-lab casing already has a precisely fitted front window.
  // Reuse that manufactured part as the removable opaque cover, preserving the
  // actual three-dimensional bezel, side shell, rounded corners and bores.
  const frontCover=new THREE.Group();root.add(frontCover);
  frontCover.position.copy(lockMount.position);
  frontCover.scale.setScalar(lockScale);
  const coverPlate=hardware.inspectionWindow;
  coverPlate.material=mat.case.clone();
  coverPlate.material.transparent=false;
  coverPlate.material.opacity=1;
  coverPlate.material.depthWrite=true;
  coverPlate.castShadow=true;
  frontCover.add(coverPlate);
  const coverHit=new THREE.Mesh(new THREE.PlaneGeometry(3.28,2.38),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  coverHit.position.z=.735;coverHit.userData={kind:'cover'};
  frontCover.add(coverHit);hitObjects.push(coverHit);
  const coverLooseHit=new THREE.Mesh(new THREE.PlaneGeometry(3.28,2.38),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,
      side:THREE.DoubleSide}));
  coverLooseHit.position.z=.735;coverLooseHit.userData={kind:'loose',index:'cover'};
  coverLooseHit.visible=false;frontCover.add(coverLooseHit);hitObjects.push(coverLooseHit);
  // A warm, thin luminous frame follows the actual removable cover.
  const framePoints=[];
  for(const [cx,cy,start] of [[1.53,1.105,0],[-1.53,1.105,Math.PI/2],
    [-1.53,-1.105,Math.PI],[1.53,-1.105,Math.PI*1.5]]){
    for(let step=0;step<=5;step++){
      const angle=start+step/5*Math.PI/2;
      framePoints.push(new THREE.Vector3(cx+Math.cos(angle)*.10,
        cy+Math.sin(angle)*.10,.774));
    }
  }
  const coverFrame=new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(framePoints,true),72,.035,6,true),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,
      depthTest:false,depthWrite:false}));
  coverFrame.visible=false;coverFrame.renderOrder=18;
  coverFrame.userData.hoverGuide=true;
  frontCover.add(coverFrame);
  const hover=createAssemblyHover({THREE,coverFrame,
    canRemoveCover:()=>canRemoveCover(),getAssemblyGuidance:()=>getAssemblyGuidance(),
    canDetachPart:id=>canDetachPart(id),getPortable:()=>portable,screws});
  const {setHoveredDetachable,setHoverViewport,animateHover}=hover;
  const physics=createRigidWorkbenchPhysics({screws,tray,trays,cover:frontCover,
    tableSurfaceZ,tableHalfX,tableHalfY,tableCenterX,lockBounds,
    trayWidth,trayHeight,wall,wallHeight,wallCenterZ,
    trayBottomCenter,trayBottomThickness,
    screwScaleFactor:lockScale,coverScaleFactor:lockScale});
  let coverRemoved=false;
  const canRemoveCover=()=>!coverRemoved&&!screwAnimations.size&&
    screws.every(screw=>screw.userData.removed);
  function getAssemblyGuidance(){
    if(!coverRemoved){
      const remaining=remainingScrews();
      if(remaining>0)return {id:null,title:`Выкрутите винты · осталось ${remaining}`,
        detail:'Нажмите на каждую из четырёх головок винтов по углам крышки.'};
      if(screwAnimations.size)return {id:null,title:'Дождитесь выхода винтов',
        detail:'После завершения вращения можно будет снять крышку.'};
      return {id:null,title:'Снимите крышку замка',
        detail:'Зажмите ЛКМ на светлой рамке крышки и перетащите её на свободное место стола.'};
    }
    return nextDisassemblyStep(detachedParts)||{id:null,
      title:'Механизм разобран',detail:'Все детали сняты. Их можно разложить по коробкам.'};
  }
  function removeCover(){
    if(coverRemoved)return 'removed';
    return canRemoveCover()?'ready':'locked';
  }
  function resetCover(){coverRemoved=false;
    physics.removeCover();
    frontCover.position.copy(lockMount.position);frontCover.rotation.set(0,0,0);
    coverHit.visible=true;coverLooseHit.visible=false;coverLooseBody=null;
    drag.reset();dustSurface.visible=true;
    setHoveredDetachable(null);
    for(const [id,meshes] of pickSurfaces)
      for(const mesh of meshes)mesh.userData.pickable=id==='shackle-0';
  }
  // Dust is a dynamic canvas texture. Each cloth stroke erases its alpha at
  // the actual surface UV, leaving progressively cleaned patches.
  const dustCanvas=document.createElement('canvas');
  dustCanvas.width=768;dustCanvas.height=512;
  const dustCtx=dustCanvas.getContext('2d');
  function coatWithDust(){
    dustCtx.clearRect(0,0,768,512);
    const noise=()=>rand();
    for(let i=0;i<6800;i++){
      const x=noise()*768,y=noise()*512,r=.3+noise()*2.2;
      dustCtx.fillStyle=`rgba(207,194,162,${.04+noise()*.11})`;
      dustCtx.beginPath();dustCtx.ellipse(x,y,r,r*(.45+noise()),noise()*6.28,0,6.28);dustCtx.fill();
    }
    const film=dustCtx.createLinearGradient(0,0,768,512);
    film.addColorStop(0,'rgba(208,195,159,.12)');
    film.addColorStop(.6,'rgba(205,196,170,.08)');
    film.addColorStop(1,'rgba(212,201,177,.16)');
    dustCtx.fillStyle=film;dustCtx.fillRect(0,0,768,512);
  }
  coatWithDust();
  // Sample just 1/64 of the dust pixels, and only recalculate after a stroke.
  // The progress indicator reflects actual transparency, not pointer travel.
  function dustOpacity(){
    const data=dustCtx.getImageData(0,0,768,512).data;
    let total=0,samples=0;
    for(let y=4;y<512;y+=8)for(let x=4;x<768;x+=8){
      total+=data[(y*768+x)*4+3];samples++;
    }
    return total/Math.max(1,samples);
  }
  const initialDustOpacity=dustOpacity();
  let dustNeedsMeasurement=false,cachedDustiness=100;
  function getDustiness(){
    if(dustNeedsMeasurement){
      cachedDustiness=initialDustOpacity>0?
        Math.round(Math.min(100,Math.max(0,dustOpacity()/initialDustOpacity*100))):100;
      dustNeedsMeasurement=false;
    }
    return cachedDustiness;
  }
  const dustTexture=new THREE.CanvasTexture(dustCanvas);
  dustTexture.colorSpace=THREE.SRGBColorSpace;
  const dustSurface=addMesh(frontCover,new THREE.PlaneGeometry(3.21,2.30),
    new THREE.MeshBasicMaterial({map:dustTexture,transparent:true,depthWrite:false,
      side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}),[0,0,.713]);
  dustSurface.renderOrder=8;dustSurface.castShadow=false;
  dustSurface.userData={kind:'dust'};hitObjects.push(dustSurface);
  const dustBrush=createDustCleaningBrush({context:dustCtx,random:rand,
    onChange:()=>{dustTexture.needsUpdate=true;dustNeedsMeasurement=true;}});
  const dustParticles=createDustParticles({THREE,root,document,random:rand});
  // A soft folded cloth sits on the table beside the screwdriver.
  const clothTexture=createClothTexture({THREE,document,rand});
  const cloth=new THREE.Group();cloth.position.set(2.75,-1.47,tableSurfaceZ+.12);
  cloth.scale.setScalar(2);root.add(cloth);
  const ragMaterial=new THREE.MeshStandardMaterial({map:clothTexture,roughness:1,side:THREE.DoubleSide});
  // Subdivided deforming cloth: per-vertex folds react to wiping speed and pressure.
  const clothGeometry=new THREE.PlaneGeometry(.80,.58,16,12);
  const clothPositions=clothGeometry.attributes.position;
  for(let i=0;i<clothPositions.count;i++){
    const x=clothPositions.getX(i),y=clothPositions.getY(i);
    if(Math.abs(x)>.375||Math.abs(y)>.265){
      const wobble=Math.sin(i*13.72)*.016+Math.cos(i*7.19)*.008;
      clothPositions.setXY(i,x+(Math.abs(x)>.375?Math.sign(x)*wobble:0),
        y+(Math.abs(y)>.265?Math.sign(y)*wobble:0));
    }
  }
  const clothMesh=addMesh(cloth,clothGeometry,ragMaterial);
  clothMesh.castShadow=true;
  const clothPhysics=createClothSimulation({THREE,geometry:clothGeometry,columns:16,rows:12});
  clothPhysics.settle();
  const dustSampleIndices=[110,93,127,76,144,58,162];
  const screwLiftAxis=new THREE.Vector3(0,0,1);
  const screwdriverAnimationTarget=new THREE.Vector3();
  const ragHit=new THREE.Mesh(new THREE.PlaneGeometry(.97,.66),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  ragHit.position.z=.06;ragHit.userData={kind:'rag'};cloth.add(ragHit);hitObjects.push(ragHit);
  const clothRest=cloth.position.clone();
  const clothTarget=clothRest.clone();
  const clothPrevious=clothRest.clone();
  const ragGrabOffset=new THREE.Vector2();
  const {surfaceAt,driverClearance}=createWorkbenchContact({screws,
    isCoverAttached:()=>!coverRemoved,tableSurfaceZ,
    lockScale,lockTopZ});
  let wiping=false,clothContact=false,clothSpeed=0,clothTime=0;
  let lastDustPuff=0;
  function setWiping(next){
    wiping=Boolean(next);clothContact=false;
    ragHit.visible=!wiping;
    if(!wiping)ragGrabOffset.set(0,0);
    if(!wiping){clothPhysics.settle();clothSpeed=0;cloth.rotation.x=0;}
    // Lifting keeps the x/y grip where the player clicked but immediately
    // brings the cloth to the top of the lock so it can start wiping.
    clothTarget.copy(cloth.position);
    clothTarget.z=wiping?lockTopZ+.11:
      surfaceAt(cloth.position.x,cloth.position.y)+.09;
    if(wiping)cloth.position.z=clothTarget.z;
    return wiping;
  }
  function captureRagGrip(point){
    if(!wiping||!point)return;
    ragGrabOffset.set(cloth.position.x-point.x,cloth.position.y-point.y);
  }
  function setRagContact(next){clothContact=wiping&&Boolean(next);}
  function puffDust(uv,intensity=.8){
    if(!wiping||!uv||coverRemoved)return false;
    const x=(uv.x-.5)*3.21*lockScale;
    const y=(uv.y-.5)*2.30*lockScale;
    dustParticles.emit(x,y,lockTopZ+.20,intensity);
    lastDustPuff=performance.now();
    // Pressing produces a small initial impression even before the cloth moves.
    dustBrush.stamp(uv.x*768,(1-uv.y)*512,.9);
    return true;
  }
  function wipeDust(uv,contact=false){
    if(!wiping||!uv||coverRemoved)return false;
    clothTarget.set((uv.x-.5)*3.21*lockScale+ragGrabOffset.x,
      (uv.y-.5)*2.30*lockScale+ragGrabOffset.y,lockTopZ+.10);
    if(contact)clothContact=true;
    return true;
  }
  // The driver is summoned for screw work and hidden in idle assembly view.
  const screwdriver=new THREE.Group();screwdriver.scale.setScalar(2);root.add(screwdriver);
  screwdriver.visible=false;
  const driverBody=new THREE.Group();screwdriver.add(driverBody);
  cyl(driverBody,.105,.72,0,0,0,mat.dark,'x',24);
  for(let i=-2;i<=2;i++)ring(driverBody,.11,.018,i*.105,0,0,mat.brass,'x');
  cyl(driverBody,.053,.82,.74,0,0,mat.steel,'x',18);
  const tip=addMesh(driverBody,new THREE.BoxGeometry(.20,.075,.035),mat.chromed,[1.19,0,0]);
  tip.castShadow=true;
  const restPosition=new THREE.Vector3(-2.65,-1.57,tableSurfaceZ+.17);
  screwdriver.position.copy(restPosition);
  screwdriver.rotation.z=Math.PI/2; // The bit points towards the far edge of the table.
  const screwdriverHit=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.38),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  screwdriverHit.position.set(.54,0,.13);
  screwdriverHit.userData={kind:'screwdriver'};screwdriver.add(screwdriverHit);
  hitObjects.push(screwdriverHit);
  let screwdriverHeld=false;
  const bitOffset=1.29*screwdriver.scale.x;
  const screwdriverTarget=screwdriver.position.clone();
  const cameraInLockSpace=new THREE.Vector3();
  let screwdriverGripTime=0;
  function heldDriverAngle(){
    if(!camera)return Math.PI/2;
    root.updateWorldMatrix(true,false);
    cameraInLockSpace.copy(camera.position);
    root.worldToLocal(cameraInLockSpace);
    return screwdriverGripAngle(screwdriver.position,cameraInLockSpace);
  }
  function setScrewdriverHeld(next){
    screwdriverHeld=Boolean(next);
    screwdriver.visible=screwdriverHeld||screwAnimations.size>0;
    screwdriverHit.visible=false;
    if(screwdriverHeld)screwdriverGripTime=performance.now();
    screwdriverTarget.copy(screwdriver.position);
    screwdriverTarget.z=screwdriverHeld?
      Math.max(lockTopZ+.36,screwdriver.position.z):
      driverClearance(screwdriver.position.x,screwdriver.position.y,Math.PI/2,2);
    return screwdriverHeld;
  }
  function moveHeldTool(point){
    if(!point)return;
    const clamp=(value,range)=>Math.max(range[0],Math.min(range[1],value));
    const x=clamp(point.x,dropBounds.x),y=clamp(point.y,dropBounds.y);
    if(wiping){
      const rx=clamp(x+ragGrabOffset.x,dropBounds.x);
      const ry=clamp(y+ragGrabOffset.y,dropBounds.y);
      clothTarget.set(rx,ry,Math.max(lockTopZ+.10,surfaceAt(rx,ry)+.09));
    }
    if(screwdriverHeld){
      // The mouse is the tip of the screwdriver. Subtract the scaled,
      // camera-facing shaft vector before positioning its handle origin.
      root.updateWorldMatrix(true,false);
      cameraInLockSpace.copy(camera.position);root.worldToLocal(cameraInLockSpace);
      const grip=screwdriverHandleForTip({x,y},cameraInLockSpace,bitOffset);
      screwdriverTarget.set(grip.x,grip.y,Math.max(lockTopZ+.36,
        driverClearance(grip.x,grip.y,grip.angle,2)));
    }
  }
  function interactionPlaneY(){
    if(dragContactWorldY!==null)return dragContactWorldY;
    if(screwdriverHeld){
      root.updateWorldMatrix(true,false);
      const point=new THREE.Vector3(0,0,screwdriverTarget.z);
      return root.localToWorld(point).y;
    }
    if(wiping){
      root.updateWorldMatrix(true,false);
      return root.localToWorld(new THREE.Vector3(0,0,clothTarget.z)).y;
    }
    return WORKBENCH_TOP_Y;
  }
  function unscrewCorner(index){
    const screw=screws[index];
    if(!screwdriverHeld||!screw||screwAnimations.has(index)||screw.userData.removed)return false;
    screwAnimations.set(index,{start:performance.now(),base:screw.userData.originalPosition.clone(),
      driverStart:screwdriver.position.clone()});
    screwdriver.visible=true;
    screw.userData.hitVolume.visible=false;
    return true;
  }
  const remainingScrews=()=>screws.reduce((count,screw,index)=>
    count+Number(!screw.userData.removed&&!screwAnimations.has(index)),0);
  function stowScrewdriver(){
    setScrewdriverHeld(false);
    screwdriverTarget.copy(restPosition);
    screwdriverTarget.z=Math.max(restPosition.z,
      driverClearance(restPosition.x,restPosition.y,Math.PI/2,2));
  }
  function updateTools(now){
    const frameDt=Math.min(.05,Math.max(.008,(now-clothTime)/1000||.016));
    clothTime=now;
    drag.update(frameDt);
    animateHover(frameDt);
    gearLock.tick(frameDt);
    oiler.tick(frameDt);
    dustParticles.update(frameDt);
    const shakeTarget=shackleHeld?Math.min(1,shacklePullDistance+.40):0;
    shackleShake+=(shakeTarget-shackleShake)*Math.min(1,frameDt*(shackleHeld?19:13));
    if(!detachedParts.has('shackle-0'))hardware.shacklePivot.position.set(
      shackleRest.x+Math.sin(now*.078)*.022*shackleShake,
      shackleRest.y+Math.cos(now*.091)*.014*shackleShake,
      shackleRest.z+Math.sin(now*.067)*.013*shackleShake);
    if(!shackleHeld)shacklePullDistance=Math.max(0,shacklePullDistance-frameDt*2.8);
    clothPrevious.copy(cloth.position);
    const follow=1-Math.exp(-(clothContact?22:10)*frameDt);
    clothTarget.z=Math.max(clothTarget.z,surfaceAt(clothTarget.x,clothTarget.y)+.09);
    cloth.position.lerp(clothTarget,follow);
    cloth.position.z=Math.max(cloth.position.z,surfaceAt(cloth.position.x,cloth.position.y)+.09);
    const vx=(cloth.position.x-clothPrevious.x)/frameDt;
    const vy=(cloth.position.y-clothPrevious.y)/frameDt;
    const speed=Math.min(4,Math.hypot(vx,vy));
    clothSpeed+=(speed-clothSpeed)*Math.min(1,frameDt*12);
    if(wiping){
      cloth.rotation.z+=(Math.atan2(vy,vx||.001)*.11-cloth.rotation.z)*Math.min(1,frameDt*8);
      cloth.rotation.x+=((clothContact?.07:0)-cloth.rotation.x)*Math.min(1,frameDt*11);
    }
    const cosine=Math.cos(cloth.rotation.z),sine=Math.sin(cloth.rotation.z);
    if(wiping)clothPhysics.update(frameDt,{velocityX:vx,velocityY:vy,
      contact:clothContact,held:true,
      collisionHeight:(localX,localY)=>surfaceAt(cloth.position.x+
        (localX*cosine-localY*sine)*cloth.scale.x,
        cloth.position.y+(localX*sine+localY*cosine)*cloth.scale.y)+.06-cloth.position.z});
    if(wiping&&clothContact&&clothSpeed>.08&&!coverRemoved&&
      cloth.position.z>lockTopZ-.04){
      // The cloth footprint drives dust removal; several contact points of the
      // actual deforming mesh are sampled instead of a pointer-sized brush.
      const vertices=clothGeometry.attributes.position;
      for(const index of dustSampleIndices){
        const localX=vertices.getX(index),localY=vertices.getY(index);
        const x=cloth.position.x+(localX*cosine-localY*sine)*cloth.scale.x;
        const y=cloth.position.y+(localX*sine+localY*cosine)*cloth.scale.y;
        if(Math.abs(x)<1.605*lockScale&&Math.abs(y)<1.15*lockScale)
          dustBrush.stamp((x/(3.21*lockScale)+.5)*768,
            (.5-y/(2.30*lockScale))*512,clothSpeed);
      }
      // Travelling strokes kick up smaller clouds at intervals. The first
      // click emits immediately via puffDust(), even while stationary.
      if(clothSpeed>.24&&now-lastDustPuff>125&&
        Math.abs(cloth.position.x)<1.605*lockScale&&
        Math.abs(cloth.position.y)<1.15*lockScale){
        dustParticles.emit(cloth.position.x,cloth.position.y,
          lockTopZ+.20,Math.min(1,clothSpeed/3));
        lastDustPuff=now;
      }
    }
    if(screwdriverHeld){
      // A short pickup transition retains its rest point, then the tool tip
      // tracks the mouse exactly without a permanent smoothing lag.
      const graspAge=now-screwdriverGripTime;
      if(graspAge>240)screwdriver.position.copy(screwdriverTarget);
      else screwdriver.position.lerp(screwdriverTarget,1-Math.exp(-17*frameDt));
    }
    else if(!screwAnimations.size)screwdriver.position.lerp(screwdriverTarget,
      1-Math.exp(-9*frameDt));
    if(!screwAnimations.size){
      const minimum=driverClearance(screwdriver.position.x,screwdriver.position.y);
      screwdriver.position.z=Math.max(screwdriver.position.z,minimum);
      screwdriverTarget.z=Math.max(screwdriverTarget.z,
        driverClearance(screwdriverTarget.x,screwdriverTarget.y));
    }
    if(!physics.ready)stepLooseScrews({screws,bodies:looseScrewBodies,dt:frameDt,
      onTray,trayContact,trayContacts,isDragging:drag.isDragging,
      tableSurfaceZ,traySurfaceZ,trayRimZ,screwScaleFactor:lockScale,dropBounds,
      supportSurfaceAt});
    let active=null;
    for(const [index,animation] of screwAnimations){
      const screw=screws[index],progress=Math.min(1,(now-animation.start)/1150);
      const ease=progress*progress*(3-2*progress);
      screw.rotation.z=screw.userData.unscrew.baseAngle+progress*Math.PI*8;
      screw.position.copy(animation.base).addScaledVector(screwLiftAxis,ease*.83*lockScale);
      if(progress>=1){screw.userData.removed=true;screwAnimations.delete(index);
        screw.userData.hitVolume.visible=false;
        looseHits[index].visible=true;
        const sign=index%2===0?-1:1;
        const looseBody={sleeping:false,
          velocity:new THREE.Vector3(sign*(.58+index*.06),(.28-index*.14),.42),
          angularVelocity:sign*4.8,angle:0,spin:sign*3.2};
        looseScrewBodies.set(index,looseBody);
        physics.spawnScrew(index,looseBody);
        if(!screwAnimations.size)setHoveredDetachable(null);}
      else active={screw,progress,driverStart:animation.driverStart};
    }
    if(!physics.ready)stepLooseCover({cover:frontCover,body:coverLooseBody,dt:frameDt,
      onTray,isDragging:drag.isDragging,tableSurfaceZ,traySurfaceZ,
      coverScaleFactor:lockScale,dropBounds,supportSurfaceAt});
    physics.step(frameDt);
    if(active){
      const approach=Math.min(1,active.progress*6);
      const retreat=Math.min(1,(1-active.progress)*6);
      const blend=Math.min(approach,retreat);
      const docking=screwdriverDockPose(active.screw.position,bitOffset);
      screwdriverAnimationTarget.set(docking.x,docking.y,docking.z);
      screwdriver.position.copy(active.driverStart).lerp(screwdriverAnimationTarget,blend);
      screwdriver.rotation.z=heldDriverAngle()*(1-blend);
      screwdriver.rotation.y=docking.rotationY*blend;
      driverBody.rotation.x=active.progress*Math.PI*8;
    }else{
      screwdriver.rotation.y=0;
      const desired=screwdriverHeld?heldDriverAngle():Math.PI/2;
      const delta=Math.atan2(Math.sin(desired-screwdriver.rotation.z),
        Math.cos(desired-screwdriver.rotation.z));
      const followAngle=screwdriverHeld&&now-screwdriverGripTime>240?1:
        1-Math.exp(-19*frameDt);
      screwdriver.rotation.z+=delta*followAngle;
      driverBody.rotation.x=0;
    }
    screwdriver.visible=!gearMode&&(screwdriverHeld||screwAnimations.size>0);
    if(gearMode)cloth.visible=false;
  }
  function resetScrews(){
    endObjectRotation();
    resetCover();
    physics.reset();
    restoreInternalParts();
    screwAnimations.clear();
    looseScrewBodies.clear();
    screws.forEach(screw=>{screw.position.copy(screw.userData.originalPosition);
      // Rapier has rotated the whole screw while it tumbled on the table.
      // Restore its complete original axis, not just the slotted-head angle.
      screw.quaternion.copy(screw.userData.originalQuaternion);
      screw.userData.removed=false;screw.userData.hitVolume.visible=true;});
    looseHits.forEach(hit=>{hit.visible=false;});
    screws.forEach(screw=>{
      screw.userData.hitVolume.position.z=screw.userData.originalPosition.z+.05;});
    screwdriver.rotation.y=0;
    screwdriver.rotation.z=screwdriverHeld?heldDriverAngle():Math.PI/2;
    setShacklePull(false);shackleShake=0;shacklePullDistance=0;
    hardware.shacklePivot.position.copy(shackleRest);
    setHoveredDetachable(null);
  }
  let pinXs=[-.44-1.5*.48,-.44-.5*.48,-.44+.5*.48,-.44+1.5*.48];
  const {makeKey,keyCutHeight}=createKeyGeometry({THREE,getPinXs:()=>pinXs,
    coreCenterY,coreCenterZ,addMesh,mat,tag,rod,parts});
  const pins=buildPinMechanism({THREE,document,rand,grainMap,material,mat,
    root:lockMount,depthRatio,tag,part,addMesh,box,cyl,ring,makeSpring,capsulePin,driverPin,
    createSpurGear:(...args)=>createSpurGear(THREE,...args),
    createKeywayPlugGeometry:geometry.createKeywayPlugGeometry,
    makeHousing:hardware.makeHousing,keyCutHeight,makeKey,modeGroups:{},
    coreCenterY,coreCenterZ});
  pinXs=pins.pinXs;
  // Laboratory picking tools belong to the separate pin-lab scene.
  for(const object of [pins.pinKey?.rig,pins.pickRig,pins.tensionRig,pins.symbolBeam]){
    if(object)object.visible=false;
  }
  const extraSurfaces=[
    {material:pins.pinDriveWheel.material,kind:'gear',mesh:pins.pinDriveWheel},
    {material:pins.pinOutputWheel.material,kind:'gear',mesh:pins.pinOutputWheel},
    ...pins.pinStacks.flatMap(st=>[st.pin,st.driver].map(mesh=>({material:mesh.material,kind:'pin'}))),
    {material:pins.manifoldWalls.material,kind:'manifold',mesh:pins.manifoldWalls},
    {material:pins.manifoldCap.material,kind:'manifold',mesh:pins.manifoldCap}
  ];
  const painted=createPaintedMaterials({THREE,document,mat,extraSurfaces});
  painted.setOptions({enabled:true,textureStrength:.95,materialStrength:.9,detail:.06,
    steelVariant:'steel',brassVariant:'brass'});
  // The mechanism starts fully assembled. The actual manufactured 3D parts
  // are removable one by one once the four screws and the cover are gone.
  const portable={
    'core-0':pins.pinPlug,'cover-0':pins.manifoldCap,
    'gear-0':pins.pinGearDrive,'gear-1':pins.pinGearOutput,
    'cam-0':hardware.lockCam,'rod-0':pins.pinGearConnectingRod,
    'bolt-0':pins.pinSlider,'shackle-0':hardware.shacklePivot,
    'frame-0':hardware.frontBezel,
    'shell-0':hardware.sideShell
  };
  pins.pinHousing.userData.retainingClips.forEach((clip,i)=>{
    portable[`clip-${i}`]=clip;
  });
  hardware.shackleCollars.forEach((collar,i)=>{
    portable[`collar-${i}`]=collar;
  });
  const fastenerFixtures=[];
  for(let i=0;i<4;i++){
    // A single rigid fitting contains the original post and its retaining
    // ring, so it can only be lifted and placed as one physical piece.
    const post=hardware.fastenerPosts[i],washer=hardware.fastenerWashers[i];
    const fixture=new THREE.Group();fixture.position.copy(post.position);
    lockMount.add(fixture);fixture.attach(post);fixture.attach(washer);
    fastenerFixtures.push(fixture);
    portable[`fastener-${i}`]=fixture;
    portable[`pin-${i}`]=pins.pinStacks[i].pin;
    portable[`driver-${i}`]=pins.pinStacks[i].driver;
    portable[`spring-${i}`]=pins.pinStacks[i].spring;
  }
  const gearLock=createGearLockMode({THREE,root,lockMount,hardware,fastenerFixtures,
    mat,hitObjects,createSpurGear:(...args)=>createSpurGear(THREE,...args)});
  const oiler=createWorkbenchOiler({THREE,document,root,hitObjects,mat,
    tableSurfaceZ,lockTopZ});
  let gearMode=false;
  function setGearMode(enabled){
    gearMode=Boolean(enabled);
    lockMount.visible=!gearMode;
    gearLock.setVisible(gearMode);
    frontCover.visible=!gearMode;
    screws.forEach(screw=>{screw.visible=!gearMode;});
    dustSurface.visible=!gearMode&&!coverRemoved;
    cloth.visible=!gearMode;
    if(gearMode)setHoveredDetachable(null);
    else gearLock.setHover(-1);
    return gearMode;
  }
  function setGearHover(hit){
    gearLock.setHover(gearMode&&hit?.kind==='gearWheel'?hit.index:-1);
  }
  function oilPart(hit){
    if(!hit)return false;
    if(gearMode){
      if(hit.kind!=='gearWheel')return false;
      if(!gearLock.lubricate(hit.index))return false;
      oiler.pourAt(gearLock.wheelCenter(hit.index));
      return true;
    }
    const id=hit.kind==='internal'?hit.id:hit.kind==='shackle'?'shackle-0':
      hit.kind==='loose'&&typeof hit.index==='string'?hit.index.slice(5):null;
    const object=id?portable[id]:hit.kind==='screw'?screws[hit.index]:null;
    if(!object)return false;
    object.updateWorldMatrix(true,false);
    const point=object.getWorldPosition(new THREE.Vector3());
    root.worldToLocal(point);point.z=Math.max(point.z,tableSurfaceZ+.05);
    oiler.pourAt(point);object.userData.oiled=true;
    return true;
  }
  const detachedParts=new Set(),originalSockets=new Map(),pickSurfaces=new Map();
  for(const [id,object] of Object.entries(portable)){
    originalSockets.set(id,{parent:object.parent,position:object.position.clone(),
      quaternion:object.quaternion.clone(),scale:object.scale.clone()});
    const meshes=[];
    object.traverse(child=>{
      if(!child.isMesh)return;
      child.userData.kind=id==='shackle-0'?'shackle':'internal';
      child.userData.id=id;
      child.userData.pickable=id==='shackle-0';
      hitObjects.push(child);meshes.push(child);
    });
    pickSurfaces.set(id,meshes);
  }
  function updateInstalled(){
    for(const [id,object] of Object.entries(portable)){
      if(!detachedParts.has(id))object.visible=true;
    }
    // Upper drivers are part of the installed pin stacks too.
    pins.pinStacks.forEach((stack,i)=>{
      if(i<4&& !detachedParts.has(`driver-${i}`))stack.driver.visible=true;
    });
  }
  updateInstalled();
  function canDetachPart(id){
    if(!coverRemoved)return {allowed:false,reason:'Сначала снимите крышку замка.'};
    if(!portable[id]||detachedParts.has(id))return {allowed:false,
      reason:'Эта деталь уже снята.'};
    const blocker=disassemblyBlocker(id,detachedParts);
    return blocker?{allowed:false,reason:`Сначала извлеките ${blocker}.`}:
      {allowed:true,reason:null};
  }
  const portableNames={
    'cover-0':'Верхняя планка штифтов','rod-0':'Соединительный вал',
    'gear-0':'Ведущая шестерня','gear-1':'Ведомая шестерня',
    'cam-0':'Поворотный кулачок','bolt-0':'Запирающий ригель',
    'shackle-0':'Закалённая дужка','core-0':'Цилиндр замка',
    'frame-0':'Передняя рамка','shell-0':'Боковой корпус'
  };
  function getAssemblyPartInfo(hit){
    if(!hit)return null;
    if(hit.kind==='screw')return {name:`Стяжной винт №${hit.index+1}`,
      description:'Нажмите, чтобы выкрутить винт.'};
    if(hit.kind==='cover')return {name:'Крышка замка',
      description:canRemoveCover()?'Зажмите ЛКМ и перенесите крышку на стол.':
        'Сначала выкрутите четыре угловых винта.'};
    if(hit.kind==='rag')return {name:'Тряпка',description:'Удерживайте ЛКМ для очистки.'};
    if(hit.kind==='screwdriver')return {name:'Отвёртка',
      description:'Используется для выкручивания угловых винтов.'};
    if(hit.kind==='oilCan')return {name:'Маслёнка',
      description:'Возьмите её и нажмите на шестерню или другую металлическую деталь.'};
    const id=hit.kind==='shackle'?'shackle-0':
      hit.kind==='internal'?hit.id:
      hit.kind==='loose'&&typeof hit.index==='string'&&hit.index.startsWith('part:')?
        hit.index.slice(5):null;
    if(hit.kind==='loose'&&hit.index==='cover')return {name:'Крышка замка',
      description:'Снятая крышка. Её можно перемещать и вращать ПКМ.'};
    if(hit.kind==='loose'&&typeof hit.index==='number')return {
      name:`Стяжной винт №${hit.index+1}`,description:'Выкрученный винт.'};
    if(!id||!portable[id])return null;
    const indexed=/^(pin|driver|spring|fastener|clip|collar)-(\d+)$/.exec(id);
    const titles={pin:'Кодовый штифт',driver:'Запирающий штифт',
      spring:'Пружина',fastener:'Крепёжная стойка с кольцом',
      clip:'Стопорная скоба цилиндра',collar:'Втулка дужки'};
    const name=indexed?`${titles[indexed[1]]} №${Number(indexed[2])+1}`:
      portableNames[id]||'Деталь механизма';
    const status=hit.kind==='loose'?null:canDetachPart(id);
    return {name,description:status&&!status.allowed?status.reason:
      'Зажмите ЛКМ и перенесите деталь на свободное место стола.'};
  }
  function beginInternalDrag(id,point){
    if(!canDetachPart(id).allowed)return false;
    const object=portable[id];detachedParts.add(id);
    if(id==='shackle-0')setShacklePull(false);
    root.attach(object);
    object.visible=true;
    pickSurfaces.get(id).forEach(mesh=>{
      mesh.userData.kind='loose';mesh.userData.index=`part:${id}`;
    });
    physics.spawnPart(id,object);
    return beginLooseDrag(`part:${id}`,point);
  }
  function restoreInternalParts(){
    for(const id of detachedParts){
      physics.removePart(id);
      const object=portable[id],socket=originalSockets.get(id);
      socket.parent.add(object);
      object.position.copy(socket.position);
      object.quaternion.copy(socket.quaternion);
      object.scale.copy(socket.scale);
      pickSurfaces.get(id).forEach(mesh=>{
        mesh.userData.kind=id==='shackle-0'?'shackle':'internal';
        mesh.userData.id=id;
        delete mesh.userData.index;
      });
    }
    detachedParts.clear();updateInstalled();
  }
  return {root,portable,updateInstalled,unscrewCorner,remainingScrews,stowScrewdriver,
    setGearMode,setGearHover,getGearState:gearLock.state,turnGear:gearLock.turn,
    resetGear:gearLock.reset,oilPart,setOilerHeld:oiler.setHeld,moveOiler:oiler.moveTo,
    canRemoveCover,canDetachPart,getAssemblyPartInfo,setHoveredDetachable,setHoverViewport,getDustiness,getAssemblyGuidance,
    removeCover,resetCover,updateTools,resetScrews,
    beginLooseDrag,beginInternalDrag,moveLooseDrag,endLooseDrag,interactionPlaneY,setShacklePull,
    beginObjectRotation,rotateObject,endObjectRotation,
    setWiping,captureRagGrip,setRagContact,wipeDust,puffDust,setScrewdriverHeld,moveHeldTool,
    dispose:()=>{oiler.dispose();physics.dispose();painted.dispose?.();dustTexture.dispose();
      dustParticles.dispose();clothTexture.dispose();trayShadowMap.dispose();
      hover.dispose();}};
}
