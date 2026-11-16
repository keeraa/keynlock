import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import {createLockStage} from '../src/js/scene/lock-stage.js';
import {createLockMaterials} from '../src/js/effects/lock-materials.js';
import {createLockHardware} from '../src/js/mechanisms/lock-hardware.js';
import {createHousingGeometries} from '../src/js/geometry/housing.js';
import {createOilToolPreview} from '../src/js/ui/oil-tool-preview.js';
import {createOilToolInput} from '../src/js/ui/oil-tool-input.js';

const context={
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  putImageData(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
  clearRect(){},fillText(){},
};
const document={createElement:()=>({width:0,height:0,getContext:()=>context})};
function seededRandom(){
  let seed=97461;
  return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
}

test('stage factory preserves the original camera, lighting, table and controls',()=>{
  class Renderer {
    constructor(options){this.options=options;this.shadowMap={};}
    setPixelRatio(value){this.pixelRatio=value;}
  }
  class Controls {
    constructor(camera,canvas){this.camera=camera;this.canvas=canvas;
      this.target=new THREE.Vector3();}
  }
  const canvas={};
  const stage=createLockStage({THREE:{...THREE,WebGLRenderer:Renderer},
    OrbitControls:Controls,canvas,pixelRatio:2});
  assert.equal(stage.renderer.options.canvas,canvas);
  assert.equal(stage.renderer.pixelRatio,1.5);
  assert.ok(stage.renderer.shadowMap.enabled);
  assert.deepEqual(stage.camera.position.toArray(),[5.4,3.2,7.7]);
  assert.ok(stage.controls.enableDamping&&stage.controls.enablePan);
  assert.equal(stage.controls.panSpeed,.85);
  assert.equal(stage.scene.children.filter(child=>child.isLight).length,4);
  assert.equal(stage.scene.children.filter(child=>child.isMesh).length,2);
  assert.ok(stage.scene.children.some(mesh=>mesh.position.y===-2.13));
});

test('metal palette shares exactly one deterministic roughness texture',()=>{
  const palette=createLockMaterials({THREE,document,rand:seededRandom()});
  assert.equal(palette.grainMap.image.width,256);
  assert.equal(palette.grainMap.repeat.x,2);
  assert.equal(palette.grainMap.colorSpace,THREE.NoColorSpace);
  assert.equal(Object.keys(palette.mat).length,13);
  for(const material of Object.values(palette.mat)) {
    assert.equal(material.roughnessMap,palette.grainMap);
    assert.equal(material.isMeshStandardMaterial,true);
  }
  assert.equal(palette.mat.glass.opacity,.24);
  assert.equal(palette.mat.glass.depthWrite,false);
  assert.ok(palette.mat.ghost.transparent);
  palette.grainMap.dispose();
  for(const material of Object.values(palette.mat))material.dispose();
});

test('shared lock hardware builds four complete screws and a rigid reusable latch',()=>{
  const root=new THREE.Group(),parts=[],raycastables=[];
  const mat=Object.fromEntries(['case','edge','dark','inner','steel','chromed','brass',
    'copper','glass'].map(key=>[key,new THREE.MeshStandardMaterial()]));
  const addMesh=(parent,geometry,material,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
    parent.add(mesh);return mesh;
  };
  const tag=(object,name)=>{object.userData.partName=name;raycastables.push(object);
    return object;};
  const part=(object,dir,distance,name)=>{
    parts.push({obj:object,base:object.position.clone(),dir:new THREE.Vector3(...dir),distance});
    if(name)tag(object,name);
    return object;
  };
  const box=(parent,w,h,d,x,y,z,material)=>
    addMesh(parent,new THREE.BoxGeometry(w,h,d),material,[x,y,z]);
  const cyl=(parent,r,h,x,y,z,material,axis='y',sides=24)=>{
    const mesh=addMesh(parent,new THREE.CylinderGeometry(r,r,h,sides),material,[x,y,z]);
    if(axis==='x')mesh.rotation.z=Math.PI/2;
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    return mesh;
  };
  const ring=(parent,r,t,x,y,z,material,axis='z')=>{
    const mesh=addMesh(parent,new THREE.TorusGeometry(r,t,8,32),material,[x,y,z]);
    if(axis==='x')mesh.rotation.y=Math.PI/2;
    return mesh;
  };
  const rod=(parent,a,b,r,material)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const mesh=addMesh(parent,new THREE.CylinderGeometry(r,r,start.distanceTo(end),8),
      material,start.clone().add(end).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
    return mesh;
  };
  const housing=createHousingGeometries({THREE,depthRatio:.7});
  const hardware=createLockHardware({THREE,document,root,depthRatio:.7,
    coreCenterY:-.43,coreCenterZ:-.05,mat,addMesh,tag,part,parts,raycastables,
    setDynamicBase:(obj,x,y,z)=>{obj.userData.dynamicBase=new THREE.Vector3(x,y,z);},
    box,cyl,ring,rod,...housing});
  assert.ok(hardware.inspectionWindow.isMesh);
  assert.ok(Math.abs(hardware.shacklePivot.scale.z-1/.7)<1e-10);
  assert.equal(parts.filter(item=>item.obj.userData.partName==='Стяжной винт').length,4);
  const threaded=raycastables.filter(mesh=>mesh.userData.partName==='Резьба стяжного винта');
  assert.equal(threaded.length,4);
  assert.equal(new Set(threaded.map(mesh=>mesh.geometry)).size,1,
    'all four screws use one shared helical geometry');
  assert.equal(hardware.lockCam.children.some(child=>child===hardware.camEccentric),true);
  assert.equal(hardware.shackleBody.released,false);
  const before=root.children.length;
  const seat=hardware.makeHousing(root,'Тестовый корпус');
  assert.equal(root.children.length,before+1);
  assert.ok(seat.children.some(child=>child.userData.partName==='Круглое отверстие цилиндра'));
  hardware.releaseShackle(new THREE.Vector3(1.52,-.64,.025),0);
  assert.equal(hardware.shackleBody.released,true);
  hardware.restoreShackle();
  assert.equal(hardware.shackleBody.released,false);
});

test('oil preview caches UI coordinates and always restores the main renderer',()=>{
  let measurements=0,renders=0,projectionUpdates=0;
  const button={getBoundingClientRect(){measurements++;
    return {left:24,top:24,right:104,bottom:104,width:80,height:80};}};
  const canvas={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:800})};
  const camera={aspect:1,updateProjectionMatrix(){projectionUpdates++;}};
  const can={rotation:{y:0}};
  const panel={scale:{x:1},userData:{baseAspect:.7}};
  const oilPreviewScene={getObjectByName:name=>name==='oil-preview-panel'?panel:null};
  let fail=false;
  const renderer={autoClear:false,info:{render:{calls:3,triangles:42}},
    setScissor(){},setScissorTest(v){this.scissorTest=v;},
    setViewport(...args){this.viewport=args;},clearDepth(){},
    render(){renders++;if(fail)throw Error('preview failed');}};
  const events=new Map();
  const window={addEventListener:(type,listener)=>events.set(type,listener)};
  const preview=createOilToolPreview({canvas,renderer,window,button,
    oilPreviewCamera:camera,oilPreviewCan:can,oilPreviewScene});
  preview.setRenderSize(800,800);
  preview.updateOilPreviewViewport();
  assert.deepEqual(preview.renderOilToolPreview(1200),{calls:3,triangles:42},
    'oil preview returns its own WebGL draw statistics');
  preview.renderOilToolPreview(1800);
  assert.equal(renders,2);
  assert.equal(measurements,1,'preview does not read DOM bounds in the animation loop');
  assert.equal(projectionUpdates,1);
  assert.ok(Math.abs(panel.scale.x-1/.7)<1e-6,'rounded oil backdrop matches the button aspect ratio');
  assert.equal(renderer.autoClear,false,'original autoClear is preserved');
  assert.equal(renderer.scissorTest,false);
  assert.deepEqual(renderer.viewport,[0,0,800,800]);
  assert.ok(events.has('resize'));
  fail=true;
  assert.throws(()=>preview.renderOilToolPreview(2200),/preview failed/);
  assert.equal(renderer.autoClear,false);
  assert.equal(renderer.scissorTest,false);
  assert.deepEqual(renderer.viewport,[0,0,800,800]);
});

test('oil tool input owns pointer capture and routes Escape through game actions',()=>{
  function target() {
    const listeners=new Map(),attributes=new Map(),classes=new Map();
    return {listeners,attributes,classes,style:{},
      classList:{toggle:(name,on)=>classes.set(name,on)},
      setAttribute:(name,value)=>attributes.set(name,value),
      addEventListener:(type,callback)=>{
        if(!listeners.has(type))listeners.set(type,[]);
        listeners.get(type).push(callback);
      },
      emit:(type,event={})=>{for(const callback of listeners.get(type)??[])callback(event);},
    };
  }
  const canvas=target(),button=target(),document=target(),window=target();
  let captured=null,started=0,moved=0,ended=0,lost=0,cancelled=0;
  const actions=[];
  canvas.setPointerCapture=id=>{captured=id;};
  canvas.hasPointerCapture=id=>captured===id;
  canvas.releasePointerCapture=id=>{if(captured===id)captured=null;};
  const input=createOilToolInput({canvas,document,window,button,tooltip:{style:{}},
    status:()=>{},dispatch:(command,meta)=>actions.push({command,meta}),
    cancelPointerClick:()=>{cancelled++;},
    findOilSurface:()=>({object:{}}),beginContact:()=>{started++;},
    moveContact:()=>{moved++;},loseContact:()=>{lost++;},
    endContact:()=>{ended++;}});
  input.toggleOilTool();
  assert.equal(button.attributes.get('aria-pressed'),'true');
  const down={button:0,metaKey:false,pointerId:7,
    preventDefault(){},stopImmediatePropagation(){}};
  canvas.emit('pointerdown',down);
  assert.equal(started,1);
  assert.equal(captured,7);
  canvas.emit('pointermove',{pointerId:7,buttons:1,metaKey:false,
    stopImmediatePropagation(){}});
  assert.equal(moved,1);
  canvas.emit('pointerdown',{...down,metaKey:true});
  assert.equal(started,1,'Command + drag retains camera pan behavior');
  document.emit('keydown',{code:'Escape'});
  assert.deepEqual(actions,[{command:{type:'oil-tool-toggle'},meta:{source:'keyboard'}}]);
  document.emit('pointerup',{pointerId:7,stopImmediatePropagation(){}});
  assert.equal(captured,null);
  assert.equal(ended,1);
  assert.equal(cancelled,1);
  assert.equal(lost,0);
  input.toggleOilTool();
  assert.equal(button.attributes.get('aria-pressed'),'false');
  assert.equal(ended,2,'switching off clears even an idle contact');
});
