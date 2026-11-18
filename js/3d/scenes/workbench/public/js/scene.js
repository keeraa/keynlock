import * as THREE from '../vendor/three.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';
import {createGeometryPrimitives} from './primitives.js';
import {createAssemblyMechanism} from './assembly-scene.js';
import {createCartoonFilter} from './lab/effects/cartoon-filter.js';
import {createFloatingParticles} from './lab/effects/floating-particles.js';
import {createScenePicking} from './scene-picking.js';
import {disposeSceneResources} from './scene-disposal.js';
import {createWorkshopMaterials,populateWorkshopRoom,WORKBENCH_TOP_Y} from './workshop-room.js';
import {assemblyOverheadDirection,assemblyOverheadPosition,
  createBenchPanController} from './workshop-camera.js';
import {targetGuideGeometry,shouldRebuildTargetGuide} from './key-guide.js';
import {createFileSurfaceMaterials,createMetalShavings,FILE_BODY_SCALE,
  FILE_STEEL_CENTER_X,
  FILE_MAX_STROKE,fileWorkingAnchor,fileStoppedAtContour,fileTouchesContour,
  createFileSteelGeometry,
  createFileHandleGeometry,fileAxialStrokePixels,
  fallingFragmentLocalY,
  FILE_CAMERA_POSITION,FILE_CAMERA_TARGET,FILE_KEYROOT_Z,
  FILE_CONTACT_DEPTH_FRONT,FILE_CONTACT_DEPTH_BACK} from './filing-effects.js';
import {createKeyBladeGeometry,KEY_BLADE_OFFSET_Z} from './key-blade.js';
import {zoneSurfaceSamples,createZoneFaceGeometry,createZoneRimGeometry,
  createZoneOutlineGeometry,zoneHighlightOpacity,dirtyCutZoneIndices} from './key-zone-highlight.js';
import {emptyWearProfile,normalizeWearProfile,applyWearToOutline,
  machinedTopAtX,inspectMachinedKey,splitMachinedOutlineAt} from './key-wear.js';
import {createKeyBow} from './key-bow.js';
import {createKeyImprintBoard} from './key-imprint-board.js';
import {TARGET_CUTS, cameraPointerAction,
  cutLayout, BREAK_CUT,KEY_BOTTOM_Y,keyProfileSegments,
  cutIndexAtX,showKeyTargetGuide} from './logic.js';

const TOP_Y=.17;

function makeTextLabel(THREE,text,color='#d5bd8c'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,96);
  ctx.fillStyle=color;ctx.font='bold 42px Georgia';ctx.textAlign='center';ctx.fillText(text,128,55);
  const texture=new THREE.CanvasTexture(canvas);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(.46,.18,1);return sprite;
}

export function createWorkshopScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
  renderer.setClearColor(0x101f25,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.28;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x14242b,.023);
  const camera=new THREE.PerspectiveCamera(40,canvas.clientWidth/canvas.clientHeight,.04,100);
  const assemblyOutline=createCartoonFilter({THREE,renderer,scene,camera});
  assemblyOutline.setOptions({toon:false,outline:true,outlineStrength:.85,outlineWidth:1.3});
  const assemblySnow=createFloatingParticles({THREE,scene,pixelRatio:renderer.getPixelRatio()});
  assemblySnow.particles.visible=false;
  camera.position.set(...FILE_CAMERA_POSITION);
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(...FILE_CAMERA_TARGET);controls.enableDamping=true;controls.dampingFactor=.07;
  controls.enablePan=true;controls.minDistance=2.1;controls.maxDistance=9.2;
  controls.minPolarAngle=.65;controls.maxPolarAngle=2.0;
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
  controls.update();
  // Interacting with a tooth or a loose part keeps the left button for tools.
  // On the rest of the canvas, an ordinary left-drag rotates the camera.
  const sceneListeners=new AbortController();
  let handheldToolActive=false;
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(mode==='assembly'){
      // Assembly and gear gestures use the workbench-plane pan controller.
      // OrbitControls stays responsible for wheel zoom and key-mode orbit.
      controls.mouseButtons.LEFT=null;
      return;
    }
    const hit=hitTest(event.clientX,event.clientY);
    const toolTarget=handheldToolActive||(keyRoot.visible?(hit?.kind==='cut'):
      ['screw','rag','screwdriver','dust','loose','cover','internal','shackle'].includes(hit?.kind));
    const gesture=cameraPointerAction({toolTarget,shiftKey:event.shiftKey,
      metaKey:event.metaKey,ctrlKey:event.ctrlKey});
    // OrbitControls swaps ROTATE and PAN when a keyboard modifier is held.
    // Cmd/Ctrl pans the tabletop; regular dragging orbits around the workpiece.
    controls.mouseButtons.LEFT=gesture==='tool'?null:
      (gesture==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE);
  },{capture:true,signal:sceneListeners.signal});
  const restoreCameraButton=()=>{
    controls.mouseButtons.LEFT=mode==='assembly'?null:THREE.MOUSE.ROTATE;
    if(mode==='assembly')controls.enablePan=!assemblyCameraLocked;
  };
  canvas.addEventListener('pointerup',restoreCameraButton,{capture:true,signal:sceneListeners.signal});
  canvas.addEventListener('pointercancel',restoreCameraButton,{capture:true,signal:sceneListeners.signal});

  const mat=createWorkshopMaterials(THREE);
  function addMesh(parent,geometry,material,position=[0,0,0]){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
    mesh.castShadow=!material.transparent;mesh.receiveShadow=!material.transparent;
    parent.add(mesh);return mesh;
  }
  const shapes=createGeometryPrimitives({THREE,RoundedBoxGeometry,addMesh,
    setDynamicBase:(g,x,y,z)=>g.position.set(x,y,z),springMaterial:mat.spring});

  populateWorkshopRoom(THREE,scene,shapes,mat);

  const keyRoot=new THREE.Group();keyRoot.position.set(-.38,-.54,FILE_KEYROOT_Z);
  keyRoot.scale.setScalar(.70);scene.add(keyRoot);
  // Shorter vise: the base remains planted on the bench while the body, jaws,
  // and clamped blank sit half a unit lower. The blade/jaw fit is unchanged.
  const VISE_LOWERING=.50;
  const viseRoot=new THREE.Group();keyRoot.add(viseRoot);
  shapes.box(viseRoot,2.52,.28,1.42,-2.13,-1.52,-.23,mat.dark,.11);
  shapes.box(viseRoot,1.50,1.70-VISE_LOWERING,1.08,-2.13,-.55-VISE_LOWERING/2,-.29,mat.dark2,.12);
  shapes.box(viseRoot,.40,.76,.40,-1.67,.66-VISE_LOWERING,-.06,mat.dark,.065);
  shapes.box(viseRoot,.42,.26,.35,-1.51,.99-VISE_LOWERING,-.03,mat.dark,.045);
  // Rear lip ends at z=.157; front lip starts at z=.208. The blank occupies
  // z≈.158–.204, so the jaws appear closed with the actual metal between them.
  shapes.box(viseRoot,.15,.27,.18,-1.30,1.20-VISE_LOWERING,.067,mat.steel,.023);
  shapes.box(viseRoot,.15,.27,.18,-1.30,1.20-VISE_LOWERING,.298,mat.dark2,.023);
  // The moving front jaw sits on a short guide, with small flush fasteners.
  shapes.box(viseRoot,.43,.28,.28,-1.51,.94-VISE_LOWERING,.31,mat.dark,.046);
  shapes.box(viseRoot,.14,.028,.02,-1.30,1.33-VISE_LOWERING,.396,mat.steel,.007);
  for(const x of [-1.34,-1.26]){
    shapes.cyl(viseRoot,.017,.02,x,1.20-VISE_LOWERING,.397,mat.spring,'z',16);
    shapes.box(viseRoot,.022,.004,.005,x,1.20-VISE_LOWERING,.41,mat.dark,.002);
  }
  // Tightening spindle and crossbar are on the LEFT, clear of the filing hand.
  shapes.cyl(viseRoot,.105,.80,-3.14,-.70,.08,mat.copper,'x',28);
  shapes.cyl(viseRoot,.17,.17,-3.53,-.70,.08,mat.dark2,'x',24);
  shapes.cyl(viseRoot,.065,.76,-3.58,-.70,.08,mat.steel,'y',22);
  for(const y of [-1.08,-.32])
    shapes.cyl(viseRoot,.095,.13,-3.58,y,.08,mat.copper,'y',20);

  // Raise the blade so its cut edge clears the vise lips, while its lower
  // portion remains firmly between both jaws.
  const blankRoot=new THREE.Group();blankRoot.position.set(-.68,1.355-VISE_LOWERING,.15);
  const blankHome=blankRoot.position.clone();
  blankRoot.scale.setScalar(.5);keyRoot.add(blankRoot);
  const imprintBoard=createKeyImprintBoard(THREE,keyRoot);
  let cutValues=[0,0,0,0],cutTargets=[...TARGET_CUTS],layout=cutLayout(4),
    wearProfile=emptyWearProfile();
  const blade=addMesh(blankRoot,
    createKeyBladeGeometry(THREE,keyProfileSegments(cutValues,layout)[0]),mat.key,[0,0,.015]);
  const bow=createKeyBow(THREE,blankRoot,mat.key,mat.copper);
  const targetMaterial=new THREE.LineBasicMaterial({color:0xffd18a,
    transparent:true,opacity:.93,depthTest:true,depthWrite:false});
  const targetLines=['front','back'].map(face=>{
    const line=new THREE.LineSegments(targetGuideGeometry(THREE,cutValues,cutTargets,layout,face),targetMaterial);
    line.renderOrder=8;blankRoot.add(line);return line;
  });
  const hitObjects=[],cutMarkers=[],cutLabels=[];
  Array.from({length:8},(_,i)=>{
    const marker=new THREE.Group();blankRoot.add(marker);
    const faceGeometry=new THREE.BufferGeometry();
    const front=addMesh(marker,faceGeometry,mat.marker.clone(),[0,0,.114]);
    const back=addMesh(marker,faceGeometry,mat.marker.clone(),
      [0,0,KEY_BLADE_OFFSET_Z-.018]);
    const rim=addMesh(marker,new THREE.BufferGeometry(),mat.marker.clone());
    const outline=new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:0xffedbf,transparent:true,opacity:0,
        depthWrite:false,depthTest:true}));
    marker.add(outline);
    for(const item of [front,back,rim]){
      item.renderOrder=9;item.castShadow=false;item.receiveShadow=false;
    }
    outline.renderOrder=10;
    marker.userData={front,back,rim,outline,targetOpacity:0};
    marker.visible=false;cutMarkers.push(marker);
    const label=makeTextLabel(THREE,String(i+1));label.position.set(0,-.69,.14);
    blankRoot.add(label);cutLabels.push(label);
  });
  // Every face of the four-sided steel file has cross-cut teeth and bump relief.
  const sawRig=new THREE.Group();keyRoot.add(sawRig);
  sawRig.rotation.set(.06,1.18,.14);
  const fileBody=new THREE.Group();sawRig.add(fileBody);
  fileBody.scale.setScalar(FILE_BODY_SCALE);
  fileBody.position.x=fileWorkingAnchor();
  const fileSurface=createFileSurfaceMaterials(THREE);
  const fileSteel=addMesh(fileBody,createFileSteelGeometry(THREE),
    fileSurface.materials,[FILE_STEEL_CENTER_X,0,0]);
  // A continuous tapered steel tang, fitted ferrule and turned wooden grip.
  // The old floating end cylinder and massive rectangular handle are gone.
  shapes.cyl(fileBody,.060,.50,-2.85,0,0,mat.steel,'x',24);
  const fileHandle=addMesh(fileBody,createFileHandleGeometry(THREE),
    mat.woodTop,[-3.33,0,0]);
  fileHandle.rotation.z=-Math.PI/2;
  shapes.cyl(fileBody,.123,.18,-2.78,0,0,mat.copper,'x',28);
  // Chips live in world space, so they remain on the table even when the
  // active work surface switches from filing to lock assembly.
  const shavings=createMetalShavings(THREE,scene,{tableY:WORKBENCH_TOP_Y});
  let activeCut=0,filingMotion=0,isFiling=false,lastBladeProfile='',fileRoll=0;
  let lastZoneProfile=[],lastZoneWearSignature='',lastGuideSignature='';
  let filePointerSeen=false,fallenPiece=null,fallenAt=0;
  let fileOrientation='top',keyMethod='guided';
  const fileTarget=new THREE.Vector3();
  let fileRequestedLocalY=0;
  let fileRequestedLocalX=0;
  function updatePhysicalFileContact(){
    const edge=machinedTopAtX(cutValues,layout,wearProfile,fileRequestedLocalX);
    const stoppedY=fileStoppedAtContour(fileRequestedLocalY,edge);
    fileTarget.y=THREE.MathUtils.clamp(
      blankRoot.position.y+stoppedY*blankRoot.scale.y,-1.4,2.7);
  }
  function applyFileOrientation(){
    const inverted=fileOrientation==='bottom';
    blankRoot.scale.y=inverted?-.5:.5;
    // Keep the smooth edge firmly between the same two vise jaws after
    // flipping. The teeth now hang below the jaw, free for filing beneath.
    blankRoot.position.y=blankHome.y+(inverted?KEY_BOTTOM_Y:0);
    imprintBoard.setOrientation(fileOrientation);
    sawRig.rotation.z=inverted?.20:-.20;
    cutLabels.forEach(label=>label.position.y=inverted?TOP_Y+.27:-.69);
    filePointerSeen=false;
    fileTarget.copy(cutLocation(activeCut));
  }
  function setFileOrientation(next){
    const normalized=next==='top'?'top':'bottom';
    const previous=fileOrientation;
    fileOrientation=normalized;
    applyFileOrientation();
    if(normalized!==previous){
      const offset=(normalized==='bottom'?1:-1)*KEY_BOTTOM_Y*keyRoot.scale.y;
      camera.position.y+=offset;
      controls.target.y+=offset;
      controls.update();
    }
  }
  function cutLocation(i){
    const cx=layout[i]?.center??0;
    return new THREE.Vector3(blankRoot.position.x+cx*blankRoot.scale.x,
      blankRoot.position.y+(TOP_Y-(cutValues[i]||0))*blankRoot.scale.y+
        Math.sign(blankRoot.scale.y)*.06,
      blankRoot.position.z+.050);
  }
  function resetFallenPiece(){
    if(!fallenPiece)return;
    fallenPiece.mesh.geometry.dispose();blankRoot.remove(fallenPiece.group);
    fallenPiece=null;fallenAt=0;
  }
  function updateCutHighlight(){
    const intact=!cutValues.some(value=>value>=BREAK_CUT);
    cutMarkers.forEach((marker,i)=>{
      const allowed=intact&&i<layout.length;
      marker.userData.targetOpacity=allowed?
        zoneHighlightOpacity(i,activeCut,isFiling,intact):0;
      if(!allowed){
        for(const item of [marker.userData.front,marker.userData.back,
          marker.userData.rim,marker.userData.outline])item.material.opacity=0;
        marker.visible=false;
      }
      else if(marker.userData.targetOpacity>0)marker.visible=true;
    });
  }
  function updateCutSlots(){
    for(let i=0;i<cutMarkers.length;i++){
      const item=layout[i],shown=Boolean(item);
      const marker=cutMarkers[i],label=cutLabels[i];
      marker.visible=false;
      for(const part of [marker.userData.front,marker.userData.back,
        marker.userData.rim,marker.userData.outline])part.material.opacity=0;
      label.visible=shown;
      if(shown){
        label.position.x=item.center;
      }
    }
    updateCutHighlight();
  }
  function refreshKey(){
    // Quantize the small filing increments to avoid creating new GPU geometry
    // for every tiny pointer event; the visible contour still tracks the stroke.
    const profile=cutValues.map(value=>(Math.round(value*250)/250).toFixed(3));
    const breakIndex=cutValues.findIndex(value=>value>=BREAK_CUT);
    const fileCuts=profile.map(Number);
    const wearBreakX=breakIndex<0?
      inspectMachinedKey(cutValues,cutTargets,layout,wearProfile).fractureX:null;
    const wearSignature=wearProfile.map(value=>Math.round(value*350)).join(',');
    const signature=`${profile.join('|')}#${breakIndex}#${wearBreakX??'intact'}#${wearSignature}`;
    const intact=breakIndex<0&&wearBreakX===null;
    // Once the metal is severed, reference guides and highlights disappear
    // instead of hovering in the space left by the detached blade.
    targetLines.forEach(line=>line.visible=showKeyTargetGuide(keyMethod,intact));
    updateCutHighlight();
    cutLabels.forEach((label,i)=>label.visible=intact&&i<layout.length);
    if(shouldRebuildTargetGuide(keyMethod,intact,signature,lastGuideSignature)){
      targetLines.forEach((line,i)=>{
        const oldGuide=line.geometry;
        line.geometry=targetGuideGeometry(THREE,fileCuts,cutTargets,layout,
          i===0?'front':'back',wearProfile);
        oldGuide.dispose();
      });
      lastGuideSignature=signature;
    }
    if(signature===lastBladeProfile)return;
    const dirtyZones=dirtyCutZoneIndices(lastZoneProfile,profile,
      lastZoneWearSignature!==wearSignature);
    for(const i of dirtyZones){
      const marker=cutMarkers[i];
      const {front,back,rim,outline}=marker.userData;
      const oldFace=front.geometry,oldRim=rim.geometry,oldOutline=outline.geometry;
      const samples=zoneSurfaceSamples(fileCuts,layout,i,wearProfile);
      front.geometry=back.geometry=createZoneFaceGeometry(THREE,fileCuts,layout,i,wearProfile,samples);
      rim.geometry=createZoneRimGeometry(THREE,fileCuts,layout,i,wearProfile,samples);
      outline.geometry=createZoneOutlineGeometry(THREE,fileCuts,layout,i,wearProfile,samples);
      oldFace.dispose();oldRim.dispose();oldOutline.dispose();
    }
    lastZoneProfile=profile;
    lastZoneWearSignature=wearSignature;
    let segments=keyProfileSegments(fileCuts,layout,breakIndex)
      .map(segment=>applyWearToOutline(segment,wearProfile));
    if(wearBreakX!==null)segments=splitMachinedOutlineAt(segments[0],wearBreakX);
    const old=blade.geometry;
    blade.geometry=createKeyBladeGeometry(THREE,segments[0]);old.dispose();
    if(!intact&&segments[1]){
      const origin=breakIndex>=0?layout[breakIndex].center+layout[breakIndex].flat:wearBreakX;
      if(!fallenPiece){
        const group=new THREE.Group();blankRoot.add(group);
        const mesh=addMesh(group,createKeyBladeGeometry(THREE,segments[1],origin),mat.key);
        fallenPiece={group,mesh};fallenAt=performance.now();
      }else{
        const oldPart=fallenPiece.mesh.geometry;
        fallenPiece.mesh.geometry=createKeyBladeGeometry(THREE,segments[1],origin);oldPart.dispose();
      }
      fallenPiece.group.position.x=origin;fallenPiece.group.position.z=.015;
    }else resetFallenPiece();
    lastBladeProfile=signature;
  }
  function setBlueprint(targets){
    cutTargets=[...targets];layout=cutLayout(cutTargets.length);
    imprintBoard.setBlueprint(cutTargets);
    imprintBoard.setDisplayMode(keyMethod);
    cutValues=Array(cutTargets.length).fill(0);wearProfile=emptyWearProfile();
    activeCut=0;filePointerSeen=false;
    lastBladeProfile='';lastZoneProfile=[];lastZoneWearSignature='';lastGuideSignature='';
    resetFallenPiece();updateCutSlots();
    fileTarget.copy(cutLocation(0));refreshKey();
  }
  function setCuts(cuts){
    cutValues=[...cuts];refreshKey();
    // A new cut exposes a new surface; recalculate only the collision stop.
    // Cursor coordinates remain authoritative throughout the drag.
    if(filePointerSeen)updatePhysicalFileContact();
    if(!filePointerSeen)fileTarget.copy(cutLocation(activeCut));
  }
  function setWear(wear){
    wearProfile=normalizeWearProfile(wear);
    refreshKey();
  }
  function setActiveCut(i){
    activeCut=Math.min(layout.length-1,Math.max(0,i));
    updateCutHighlight();
    if(!filePointerSeen)fileTarget.copy(cutLocation(activeCut));
  }
  function setFiling(active){isFiling=active;if(!active)filingMotion=0;updateCutHighlight();}
  function setKeyMethod(next){
    keyMethod=next==='imprint'||next==='soap'?next:'guided';
    imprintBoard.setDisplayMode(keyMethod);
    refreshKey();
  }
  function rotateFile(delta){
    fileRoll=THREE.MathUtils.euclideanModulo(fileRoll+delta+Math.PI,Math.PI*2)-Math.PI;
    return fileRoll;
  }
  function filingContact(){
    if(cutValues.some(v=>v>=BREAK_CUT))return -1;
    const index=cutIndexAtX(fileRequestedLocalX,layout);
    if(!filePointerSeen||index<0)return -1;
    const edge=machinedTopAtX(cutValues,layout,wearProfile,fileRequestedLocalX);
    return fileTouchesContour(fileRequestedLocalY,edge)?index:-1;
  }
  function filingPulse(amount){
    // Stroke displacement accumulates with the player's push/pull and changes
    // direction immediately on reversal, as a hand-held file should.
    filingMotion=THREE.MathUtils.clamp(filingMotion+amount*.28,
      -FILE_MAX_STROKE,0);
  }
  function filingChips(strength){
    if(isFiling&&strength>.025){
      const origin=fileTarget.clone();
      origin.y-=.024;
      keyRoot.updateWorldMatrix(true,false);
      keyRoot.localToWorld(origin);
      shavings.emit(origin,strength,(layout[activeCut]?.hitWidth||.5)*keyRoot.scale.x);
    }
  }
  setBlueprint(cutTargets);

  const assembly=createAssemblyMechanism({scene,addMesh,hitObjects,camera});
  const assemblyRoot=assembly.root;
  const {setAssemblyDesign,updateInstalled,
    unscrewCorner,remainingScrews,stowScrewdriver,canRemoveCover,canDetachPart,
    setGearMode:toggleGearLock,setGearHover,getGearState,turnGear,resetGear,
    oilPart,setOilerHeld,moveOiler,
    getDustiness,getAssemblyGuidance,getAssemblyPartInfo,setHoveredDetachable,removeCover,
    beginLooseDrag,beginInternalDrag,moveLooseDrag,endLooseDrag,
    interactionPlaneY,setShacklePull,updateTools,resetScrews,
    setWiping,captureRagGrip,setRagContact,wipeDust,puffDust,
    setScrewdriverHeld,moveHeldTool}=assembly;

  let gearStudyActive=false;
  function setGearMode(next){
    gearStudyActive=Boolean(next);
    toggleGearLock(gearStudyActive);
    if(!gearStudyActive)setGearHover(null);
  }

  const {hitTest,pointerToolPoint,keyPointer}=createScenePicking({
    THREE,canvas,camera,blankRoot,keyRoot,assemblyRoot,hitObjects,
    getLayout:()=>layout,getCuts:()=>cutValues,canDetachPart,
    isGearMode:()=>gearStudyActive
  });
  function setFilePointer(clientX,clientY){
    const projection=keyPointer(clientX,clientY);if(!projection)return;
    const {point,back}=projection;
    fileRequestedLocalX=point.x;
    fileRequestedLocalY=point.y;
    fileTarget.x=THREE.MathUtils.clamp(blankRoot.position.x+point.x*blankRoot.scale.x,-3,3);
    // The middle of the steel works at the underside of the key. Its leading
    // half travels INTO the scene behind the brass (depth-tested), while the
    // ferrule and handle remain in front of the workpiece.
    fileTarget.z=blankRoot.position.z+
      (back?FILE_CONTACT_DEPTH_BACK:FILE_CONTACT_DEPTH_FRONT)*blankRoot.scale.z;
    updatePhysicalFileContact();
    filePointerSeen=true;
  }
  function setFilePointerActive(active){filePointerSeen=Boolean(active);}
  const fileAxisStart=new THREE.Vector3(),fileAxisEnd=new THREE.Vector3();
  function fileStrokePixels(dx,dy){
    sawRig.updateWorldMatrix(true,false);
    fileAxisStart.set(0,0,0).applyMatrix4(sawRig.matrixWorld).project(camera);
    fileAxisEnd.set(1,0,0).applyMatrix4(sawRig.matrixWorld).project(camera);
    const width=canvas.clientWidth,height=canvas.clientHeight;
    return fileAxialStrokePixels(dx,dy,
      (fileAxisEnd.x-fileAxisStart.x)*width/2,
      (fileAxisStart.y-fileAxisEnd.y)*height/2);
  }

  // Shift framing slightly left to keep room for the right-hand control panel.
  const assemblyCameraTarget=new THREE.Vector3(.55,-1.5,-.5);
  const benchPan=createBenchPanController({THREE,canvas,camera,controls,
    planeY:assemblyCameraTarget.y});
  const assemblyCameraDirection=assemblyOverheadDirection(THREE);
  const rememberedViews={
    key:{position:camera.position.clone(),target:controls.target.clone()},
    assembly:{position:assemblyOverheadPosition(THREE,assemblyCameraTarget),
      target:assemblyCameraTarget.clone()}
  };
  let mode='key',lastFrame=performance.now(),frames=0,fps=0,fpsClock=lastFrame;
  let assemblyCameraLocked=true;
  const rotationSpherical=new THREE.Spherical(),rotationOffset=new THREE.Vector3();
  function beginInspectionRotation(hit){
    if(mode!=='assembly')return null;
    if(assembly.beginObjectRotation(hit))return 'part';
    return 'lock';
  }
  function rotateInspection(kind,dx,dy){
    if(kind==='part')return assembly.rotateObject(dx,dy);
    if(kind!=='lock'||mode!=='assembly')return false;
    if(assemblyCameraLocked)setAssemblyCameraLocked(false);
    rotationOffset.subVectors(camera.position,controls.target);
    rotationSpherical.setFromVector3(rotationOffset);
    rotationSpherical.theta-=dx*.009;
    rotationSpherical.phi=THREE.MathUtils.clamp(
      rotationSpherical.phi-dy*.008,.14,Math.PI-.14);
    camera.position.copy(controls.target).add(
      rotationOffset.setFromSpherical(rotationSpherical));
    camera.lookAt(controls.target);
    controls.update();
    return true;
  }
  function endInspectionRotation(kind){
    if(kind==='part')assembly.endObjectRotation();
  }
  let renderedPolygons=0;
  const cameraInKeySpace=new THREE.Vector3();
  function enforceAssemblyOverhead(){
    const distance=Math.max(controls.minDistance,
      Math.min(controls.maxDistance,camera.position.distanceTo(controls.target)||11.5));
    // Move over the tabletop in X/Z, without allowing a screen-space pan to
    // lift the camera vertically away from the work surface.
    controls.target.y=assemblyCameraTarget.y;
    camera.position.copy(controls.target).addScaledVector(assemblyCameraDirection,distance);
    camera.lookAt(controls.target);
  }
  function setAssemblyCameraLocked(value){
    assemblyCameraLocked=Boolean(value);
    if(mode==='assembly'){
      controls.enableRotate=!assemblyCameraLocked;
      controls.enablePan=!assemblyCameraLocked;
      controls.enableDamping=!assemblyCameraLocked;
      restoreCameraButton();
      if(assemblyCameraLocked)enforceAssemblyOverhead();
      controls.update();
      if(assemblyCameraLocked)enforceAssemblyOverhead();
    }
    return assemblyCameraLocked;
  }
  function setMode(next){
    if(next!==mode){
      benchPan.cancel();
      rememberedViews[mode].position.copy(camera.position);
      rememberedViews[mode].target.copy(controls.target);
      camera.position.copy(rememberedViews[next].position);
      controls.target.copy(rememberedViews[next].target);
    }
    camera.up.set(0,next==='assembly'?0:1,next==='assembly'?-1:0);
    controls.enableRotate=next!=='assembly'||!assemblyCameraLocked;
    controls.enablePan=next!=='assembly'||!assemblyCameraLocked;
    controls.enableDamping=next!=='assembly'||!assemblyCameraLocked;
    controls.maxDistance=next==='assembly'?19:9.2;
    controls.minPolarAngle=next==='assembly'?0:.65;
    controls.maxPolarAngle=next==='assembly'?Math.PI:2.0;
    if(next==='assembly'&&assemblyCameraLocked)enforceAssemblyOverhead();
    camera.lookAt(controls.target);
    mode=next;keyRoot.visible=next==='key';assemblyRoot.visible=next==='assembly';
    controls.mouseButtons.MIDDLE=next==='assembly'?null:THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT=next==='assembly'?null:THREE.MOUSE.ROTATE;
    if(next!=='assembly')setHoveredDetachable?.(null);
    restoreCameraButton();
    assemblySnow.particles.visible=next==='assembly';
    if(next==='key')filePointerSeen=false;
    controls.update();
    if(next==='assembly'&&assemblyCameraLocked)enforceAssemblyOverhead();}
  setMode('key');
  let stopped=false,suspended=false,frameId=0;
  function frame(now){
    if(stopped||suspended){frameId=0;return;}
    frameId=requestAnimationFrame(frame);
    controls.update();
    if(mode==='assembly'&&assemblyCameraLocked)enforceAssemblyOverhead();
    const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));
    if(mode==='assembly'){updateTools(now);assemblySnow.update(dt);}
    shavings.update(dt);
    const highlightEase=1-Math.exp(-14*dt);
    for(const marker of cutMarkers){
      const target=marker.userData.targetOpacity||0;
      if(!marker.visible&&target<=0)continue;
      const {front,back,rim,outline}=marker.userData;
      const opacity=front.material.opacity+(target-front.material.opacity)*highlightEase;
      front.material.opacity=opacity;
      back.material.opacity=opacity*.95;
      rim.material.opacity=opacity;
      outline.material.opacity=Math.min(.72,opacity*1.8);
      if(target===0&&opacity<.006){
        for(const item of [front,back,rim,outline])item.material.opacity=0;
        marker.visible=false;
      }
    }
    // The steel's middle follows the cursor and stops on the real contour.
    sawRig.position.copy(fileTarget);
    sawRig.visible=mode==='key'&&(filePointerSeen||isFiling);
    // As the camera orbits, the handle continues to point toward the player.
    keyRoot.updateWorldMatrix(true,false);
    cameraInKeySpace.copy(camera.position);keyRoot.worldToLocal(cameraInKeySpace);
    const facing=Math.atan2(cameraInKeySpace.z-sawRig.position.z,
      sawRig.position.x-cameraInKeySpace.x);
    // The leading half goes behind the brass; the handle points toward the
    // viewer, with the middle of the steel resting on the cutting edge.
    const desiredYaw=facing+.67;
    const yawDelta=THREE.MathUtils.euclideanModulo(desiredYaw-sawRig.rotation.y+Math.PI,
      Math.PI*2)-Math.PI;
    sawRig.rotation.y+=yawDelta*.24;
    // Roll around the length of the file, exposing any of its four working faces.
    fileBody.rotation.x+= (fileRoll-fileBody.rotation.x)*.28;
    fileBody.position.x=fileWorkingAnchor()+filingMotion;
    filingMotion*=isFiling?.91:.55;
    if(fallenPiece){
      const t=Math.max(0,(now-fallenAt)/1000);
      const drop=Math.min(5.2,3.2*t*t);
      const bounce=t>1.28?.10*Math.exp(-(t-1.28)*5)*Math.abs(Math.sin((t-1.28)*14)):0;
      fallenPiece.group.position.y=fallingFragmentLocalY(
        drop,bounce,keyRoot.scale.y*blankRoot.scale.y);
      fallenPiece.group.rotation.z=-Math.min(.90,t*.95);
      fallenPiece.group.rotation.x=Math.min(.45,t*.35);
    }
    const frameStats=assemblyOutline.render();
    // The postprocessing quad is the last WebGL render pass. Count the scene
    // pass instead, excluding normal/depth passes and the fullscreen quad.
    renderedPolygons=frameStats.sceneTriangles??frameStats.triangles??0;
    frames++;
    if(now-fpsClock>800){fps=Math.round(frames*1000/(now-fpsClock));frames=0;fpsClock=now;}
    lastFrame=now;
  }
  frameId=requestAnimationFrame(frame);
  const resizeObserver=new ResizeObserver(()=>{
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    assemblyOutline.resize(w,h,renderer.getPixelRatio());
    assembly.setHoverViewport(w,h);
  });resizeObserver.observe(canvas);
  assembly.setHoverViewport(canvas.clientWidth||1200,canvas.clientHeight||800);
  canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal:sceneListeners.signal});
  return {setMode,setAssemblyCameraLocked,
    beginCameraPan:(pointerId,x,y)=>mode==='assembly'&&benchPan.begin(pointerId,x,y),
    moveCameraPan:(pointerId,x,y)=>benchPan.move(pointerId,x,y),
    endCameraPan:pointerId=>benchPan.end(pointerId),
    isAssemblyCameraLocked:()=>mode==='assembly'&&assemblyCameraLocked,setSuspended:value=>{
    const next=Boolean(value);
    if(next===suspended)return;
    suspended=next;
    if(suspended){
      cancelAnimationFrame(frameId);frameId=0;fps=0;renderedPolygons=0;
    }else if(!stopped){
      lastFrame=performance.now();fpsClock=lastFrame;frames=0;
      frameId=requestAnimationFrame(frame);
    }
  },
    setBlueprint,setCuts,setWear,setActiveCut,setFiling,
    setKeyMethod,setFileOrientation,rotateFile,filingContact,filingPulse,filingChips,
    setFilePointer,setFilePointerActive,fileStrokePixels,
    hitTest,pointerToolPoint,updateInstalled,setAssemblyDesign,
    setGearMode,setGearHover,getGearState,turnGear,resetGear,oilPart,
    setOilerHeld,moveOiler,
    unscrewCorner,remainingScrews,stowScrewdriver,canRemoveCover,canDetachPart,
    getDustiness,getAssemblyGuidance,getAssemblyPartInfo,setHoveredDetachable,removeCover,
    beginInspectionRotation,rotateInspection,endInspectionRotation,
    beginLooseDrag,beginInternalDrag,moveLooseDrag,endLooseDrag,
    interactionPlaneY,setShacklePull,resetScrews,setWiping,setRagContact,wipeDust,puffDust,
    captureRagGrip,setScrewdriverHeld,moveHeldTool,
    setToolHeld:active=>{handheldToolActive=Boolean(active);},
    setVisualOptions:options=>assemblyOutline.setOptions(options),
    getFps:()=>fps,getPolygons:()=>renderedPolygons,
    dispose:()=>{stopped=true;cancelAnimationFrame(frameId);frameId=0;
      sceneListeners.abort();resizeObserver.disconnect();controls.dispose();
      assemblyOutline.dispose();assemblySnow.dispose();
      assembly.dispose();
      imprintBoard.dispose();shavings.dispose();fileSurface.dispose();bow.dispose();
      disposeSceneResources(scene);
      // The marker template is cloned before attachment and isn't in the graph.
      mat.marker.dispose();renderer.dispose();}};
}
