import * as THREE from '../vendor/three.js';
import {hasExtraHardware} from './assembly-design.js';
import {manualIllustration} from './manual.js';
import {createLaboratoryLockVisual} from './lab-lock-visual.js';

// The workbench uses the genuine laboratory mechanism and its simulated loose
// hardware. The former flat, animation-only inventory and socket meshes have
// been removed; replacement assembly pieces will use rigid bodies as well.
export function createAssemblyMechanism({scene,addMesh,hitObjects,camera}){
  const root=new THREE.Group();
  root.position.set(.03,-1.5,-.5);
  root.rotation.x=-Math.PI/2;
  root.scale.set(.64,.8,.256);
  root.visible=false;
  scene.add(root);

  // The physical sheet follows the current lock type, with a distinct page
  // for the five-wheel drive. One page is rendered at a time onto the paper.
  const paperCanvas=document.createElement('canvas');
  paperCanvas.width=1120;paperCanvas.height=620;
  const paperTexture=new THREE.CanvasTexture(paperCanvas);
  paperTexture.colorSpace=THREE.SRGBColorSpace;
  const paper=addMesh(root,new THREE.PlaneGeometry(4.65,2.48),
    new THREE.MeshBasicMaterial({map:paperTexture,side:THREE.DoubleSide}),[-5.15,.03,-.49]);
  paper.castShadow=false;
  let paperSignature='',disposed=false,paperMode='pins';
  let sheetOrder=[2,0,3,1],sheetRatio='12:16',sheetHardware=false;
  function redrawPaper(){
    const signature=[paperMode,...sheetOrder,sheetRatio,sheetHardware].join('|');
    if(signature===paperSignature)return;
    paperSignature=signature;
    if(typeof Image==='undefined')return;
    const img=new Image();
    img.onload=()=>{
      if(disposed||signature!==paperSignature)return;
      const ctx=paperCanvas.getContext('2d');
      ctx.clearRect(0,0,1120,620);
      ctx.drawImage(img,0,0,1120,620);
      paperTexture.needsUpdate=true;
    };
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(
      manualIllustration(sheetOrder,{ratio:sheetRatio,hardware:sheetHardware,mode:paperMode}));
  }

  const laboratory=createLaboratoryLockVisual(root,hitObjects,camera);
  function setAssemblyDesign(variant,design,nextPinOrder=[2,0,3,1]){
    sheetOrder=variant==='free'?design.order:nextPinOrder;
    sheetRatio=variant==='free'?design.ratio:'12:16';
    sheetHardware=hasExtraHardware(variant,design);
    redrawPaper();
  }
  function setGearMode(enabled){
    laboratory.setGearMode(enabled);
    paperMode=enabled?'gears':'pins';
    redrawPaper();
  }
  return {
    root,setAssemblyDesign,
    updateInstalled:installed=>laboratory.updateInstalled(installed),
    unscrewCorner:laboratory.unscrewCorner,
    remainingScrews:laboratory.remainingScrews,
    stowScrewdriver:laboratory.stowScrewdriver,
    canRemoveCover:laboratory.canRemoveCover,
    canDetachPart:laboratory.canDetachPart,
    setGearMode,
    setGearHover:laboratory.setGearHover,
    getGearState:laboratory.getGearState,
    turnGear:laboratory.turnGear,
    resetGear:laboratory.resetGear,
    oilPart:laboratory.oilPart,
    setOilerHeld:laboratory.setOilerHeld,
    moveOiler:point=>{
      if(!point)return;
      root.updateWorldMatrix(true,false);
      const world=root.localToWorld(point.clone());
      laboratory.root.updateWorldMatrix(true,false);
      laboratory.moveOiler(laboratory.root.worldToLocal(world));
    },
    getAssemblyPartInfo:laboratory.getAssemblyPartInfo,
    getDustiness:laboratory.getDustiness,
    getAssemblyGuidance:laboratory.getAssemblyGuidance,
    setHoveredDetachable:laboratory.setHoveredDetachable,
    setHoverViewport:laboratory.setHoverViewport,
    removeCover:laboratory.removeCover,
    beginLooseDrag:(index,worldHit)=>laboratory.beginLooseDrag(index,
      worldHit?root.worldToLocal(worldHit.clone()):null),
    beginInternalDrag:(id,worldHit)=>laboratory.beginInternalDrag(id,
      worldHit?root.worldToLocal(worldHit.clone()):null),
    moveLooseDrag:laboratory.moveLooseDrag,
    endLooseDrag:laboratory.endLooseDrag,
    beginObjectRotation:laboratory.beginObjectRotation,
    rotateObject:laboratory.rotateObject,
    endObjectRotation:laboratory.endObjectRotation,
    interactionPlaneY:laboratory.interactionPlaneY,
    setShacklePull:laboratory.setShacklePull,
    updateTools:laboratory.updateTools,
    resetScrews:laboratory.resetScrews,
    setWiping:laboratory.setWiping,
    captureRagGrip:point=>{
      if(!point)return;
      root.updateWorldMatrix(true,false);
      const world=root.localToWorld(point.clone());
      laboratory.root.updateWorldMatrix(true,false);
      laboratory.captureRagGrip(laboratory.root.worldToLocal(world));
    },
    setRagContact:laboratory.setRagContact,
    wipeDust:laboratory.wipeDust,
    puffDust:laboratory.puffDust,
    setScrewdriverHeld:laboratory.setScrewdriverHeld,
    moveHeldTool:point=>{
      if(!point)return;
      root.updateWorldMatrix(true,false);
      const world=root.localToWorld(point.clone());
      laboratory.root.updateWorldMatrix(true,false);
      laboratory.moveHeldTool(laboratory.root.worldToLocal(world));
    },
    dispose:()=>{disposed=true;laboratory.dispose();}
  };
}
