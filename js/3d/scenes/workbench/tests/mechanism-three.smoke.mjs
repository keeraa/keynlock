import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMechanism3D} from '../public/js/mechanism-3d.js';
import {demoMechanism,mechanismPreset,createMechanismRuntime,stepMechanism,
  buildContacts,canPick} from '../public/js/mechanism-engine.js';

const listeners=new Map();
const bounds={left:0,top:0,width:920,height:610};
const canvas={parentElement:{},getBoundingClientRect:()=>bounds,
  addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
class ResizeObserverStub{observe(){} disconnect(){}}
globalThis.ResizeObserver=ResizeObserverStub;
globalThis.window={devicePixelRatio:1};
const labels=[];
globalThis.document={
  createElement(name){assert.equal(name,'canvas');return {
    width:0,height:0,toDataURL:()=>'data:image/png;base64,THREEDMODEL',
    getContext:()=>({fillText(){},fillStyle:'',font:'',textAlign:'',
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})};},
  getElementById(){const stat={textContent:''};labels.push(stat);return stat;}
};
const renders=[];
let currentTarget=null,thumbnailsDrawn=0;
const stage=createMechanism3D(canvas,{
  rendererFactory:()=>({
    setPixelRatio(){},setSize(){},shadowMap:{},info:{render:{triangles:25000}},
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      if(currentTarget){
        const miniature=scene.children.find(child=>child.name.startsWith('mechanical-part-'));
        assert.ok(miniature,'catalog must render actual 3D component geometry');
        thumbnailsDrawn++;
      }else renders.push({scene,camera});},
    getRenderTarget(){return currentTarget;},setRenderTarget(value){currentTarget=value;},
    getClearColor(){return new THREE.Color(0x111111);},getClearAlpha(){return 1;},
    setClearColor(){},clear(){},readRenderTargetPixels(_rt,_x,_y,_w,_h,pixels){pixels.fill(180);},
    dispose(){}
  }),
  controlsFactory:(camera)=>({target:new THREE.Vector3(),mouseButtons:{},
    update(){camera.lookAt(this.target);camera.updateMatrixWorld();},dispose(){}})
});
const parts=demoMechanism();
let runtime=createMechanismRuntime();
stage.open();
for(let i=0;i<3;i++){
  runtime=stepMechanism(parts,runtime,{key:0},.3).runtime;
  const result=stepMechanism(parts,runtime,{key:1,tension:true},.5);
  runtime=result.runtime;
  stage.render({parts,view:result,mode:'build',selected:null,showContacts:true,
    wedges:{},pickId:null,pickUntil:0,tension:true},1000+i*140);
}
assert.equal(renders.length,3,'3D scene should render repeatedly');
const {scene,camera}=renders.at(-1);
const meshes=[];scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
assert.ok(meshes.length>110,'housing and parts should be built from 3D meshes');
assert.ok(!meshes.some(mesh=>mesh.geometry.type==='TorusGeometry'&&
  mesh.geometry.parameters.radius>=.6),
  'large decorative selection rings must never surround mechanism components');
assert.ok(meshes.some(o=>o.geometry.type==='ExtrudeGeometry'),'teeth and lid must have depth');
assert.ok(meshes.some(o=>o.geometry.type==='TubeGeometry'),'springs must be 3D coils');
const keyway=scene.getObjectByName('keyway-left-wall');
const shackle=scene.getObjectByName('shackle-right');
assert.ok(keyway&&shackle,'physical side entry and right shackle must exist');
assert.ok(new THREE.Box3().setFromObject(keyway).min.x<-5.7,'keyhole occupies the LEFT wall');
const guides=Array.from({length:5},(_,i)=>keyway.getObjectByName('keyway-tension-guide-'+i));
assert.ok(guides.every(Boolean),'all five physical keyway contours are modeled');
assert.ok(guides.every(guide=>guide.children.some(child=>child.name==='bent-keyway-guide-rail')),
  'keyway guides follow the actual bends, not a generic rectangular opening');
assert.equal(guides.filter(guide=>guide.visible).length,1);
assert.equal(guides[2].visible,true,'default entry fits the double-bend shaft');
assert.ok(new THREE.Box3().setFromObject(shackle).max.x>7,'shackle extends to the RIGHT');
const bank=scene.getObjectByName('mechanical-part-pinbank');
assert.ok(bank?.children?.length>=3,'secret has one installed physical assembly');
const pinElements=[];bank.traverse(object=>{if(object.name.startsWith('coded-pin-'))pinElements.push(object);});
assert.equal(pinElements.length,5,'five real lower pin meshes with separate drivers and springs');
const classic=scene.getObjectByName('pin-lab-classic-housing');
assert.ok(classic,'original pin-lock casting must be used');
assert.equal(classic.children.filter(child=>child.isMesh).length,3,
  'rear cover, through-bored continuous shell and front bezel must match pin lab');
assert.ok(classic.children.some(o=>o.geometry.groups.length===2),
  'one continuous side shell has capped and pierced side surfaces');
const lid=scene.getObjectByName('classic-front-cover');
assert.ok(lid,'rounded classical front cover closes the lock');
assert.equal(lid.parent.visible,false,'assembly should show the lock cutaway');
const couplingGroup=scene.getObjectByName('transmission-coupling');
assert.ok(couplingGroup?.getObjectByName('coupled-steel-shaft'),
  'each contact must have a real continuous steel linkage, not an orange selection ring');

function project(part,z){
  const pt=new THREE.Vector3((part.x-460)*.012,(305-part.y)*.012,z).project(camera);
  return {clientX:(pt.x+1)/2*920,clientY:(1-pt.y)/2*610};
}
const secret=parts.find(part=>part.id==='secret');
assert.equal(stage.hitPart(project(secret,.72),'build'),secret.id,
  'raycaster must select a physical 3D part');
const point=stage.eventToBoard(project(secret,.48));
assert.ok(Math.abs(point.x-secret.x)<3&&Math.abs(point.y-secret.y)<3,
  'screen coordinates should intersect the mounting plane');
stage.setCutaway(false);
stage.render({parts,view:stepMechanism(parts,runtime),mode:'build',selected:null,
  showContacts:true,wedges:{},pickId:null,pickUntil:0,tension:false},1900);
assert.equal(lid.parent.visible,true,'external inspection closes the actual shell');
assert.equal(stage.hitPart(project(secret,.72),'build'),null,
  'closed cover must block direct manipulation of inner parts');
stage.setCutaway(true);

for(const name of ['ratchet','dual']){
  const example=mechanismPreset(name);
  const current=stepMechanism(example,createMechanismRuntime(),{key:0,tension:false},.9);
  stage.render({parts:example,view:current,mode:'build',selected:null,showContacts:false,
    wedges:{},pickId:null,pickUntil:0,tension:true,motionActive:['secret']},2000);
  assert.equal(guides[name==='ratchet'?1:4].visible,true,
    'each preset physically changes the guide around the keyway');
  let count=0;scene.traverse(object=>{if(object.name==='transmission-coupling')count++;});
  assert.equal(count,buildContacts(example).length,`${name}: every actual contact has a physical sleeve`);
  assert.equal(scene.getObjectByName('transmission-coupling').parent.visible,true,
    'real metal couplings remain visible with overlays off');
  const exampleBolt=scene.getObjectByName('mechanical-part-bolt');
  const farEnd=new THREE.Box3().setFromObject(exampleBolt).max.x;
  assert.ok(Math.abs(farEnd-5.36)<.2,
    `${name}: even a rearranged bolt must reach the same right-hand shackle (at ${farEnd})`);
}

const view=stepMechanism(parts,runtime,{key:0},.2);
stage.render({parts,view,mode:'attack',selected:null,showContacts:true,
  wedges:{},pickId:null,pickUntil:0,tension:true},2200);
const hook=scene.getObjectByName('standard-pin-lab-hook');
const wrench=scene.getObjectByName('standard-pin-lab-tension-wrench');
assert.ok(hook?.getObjectByName('one-piece-hook-and-tip'),
  'attack renders the actual pin laboratory hook rather than a generic straight stick');
assert.ok(hook?.getObjectByName('pin-lab-painted-lacquer-handle'),
  'the standard curved wooden handle is part of the same pick rig');
assert.equal(wrench?.children.length,5,'all five actual pin laboratory wrench profiles are reusable');
assert.equal(wrench.children.filter(item=>item.visible).length,1,'only one inserted wrench at a time');
assert.ok(new THREE.Box3().setFromObject(hook).max.x>-5.7 &&
  new THREE.Box3().setFromObject(wrench).max.x>-5.7,
  'both genuine steel tips enter the LEFT keyway rather than floating on top of the cover');
stage.render({parts,view,mode:'attack',selected:null,showContacts:false,
  pickId:'secret:2',pickUntil:2600,tension:true,wrenchIndex:4,activePin:2},2300);
assert.equal(wrench.children[4].visible,true,'selected wrench shape changes the 3D instrument');
assert.equal(wrench.children[2].visible,false,'previous wrench disappears from the keyway');
stage.render({parts,view,mode:'attack',selected:null,showContacts:false,
  pickId:null,pickUntil:0,tension:false,wrenchIndex:4,activePin:2},2700);
assert.equal(wrench.visible,false,'removing tension physically withdraws its wrench');
stage.render({parts,view,mode:'attack',selected:null,showContacts:false,
  pickId:null,pickUntil:0,tension:false,wrenchIndex:4,
  wrenchAttemptUntil:3200,activePin:2},2850);
assert.equal(wrench.visible,true,'a rejected tool briefly appears at the keyway mouth');
assert.ok(new THREE.Box3().setFromObject(wrench).max.x<-5.65,
  'a wrong bend must stop near the entrance instead of sliding fully in');
assert.equal(hook.visible,true,'the hook remains visible as an available instrument');
const candidate=parts.find(part=>canPick(part,parts));
assert.ok(candidate,'demonstration should have an accessible lockpicking target');
const marker=scene.getObjectByName('keyway-pick-target');
assert.ok(marker,'picking hotspot must be on the side keyhole');
const markerPosition=marker.getWorldPosition(new THREE.Vector3());
const projected=markerPosition.project(camera);
assert.equal(stage.hitPart({clientX:(projected.x+1)/2*920,clientY:(1-projected.y)/2*610},
  'attack'),candidate.id,'closed lock should only expose the LEFT keyhole contact');
assert.equal(lid.parent.visible,true,'attack must always close the shell');
for(let i=0;i<12;i++)stage.render({parts,view,mode:'attack',selected:null,
  showContacts:true,wedges:{},pickId:null,pickUntil:0,tension:true,unlocked:true},2300+i*80);
assert.ok(shackle.position.x>.5,'right shackle slides out of its socket after unlocking');
const thumbnailImages=stage.captureThumbnails(['pinbank','gear','lever','cam','latch','shield']);
assert.equal(Object.keys(thumbnailImages).length,6,
  'catalog thumbnails must be rendered by the same Three.js part models');
assert.equal(thumbnailsDrawn,6,'one preview scene rendered per mechanism part');
assert.ok(Object.values(thumbnailImages).every(src=>src.startsWith('data:image/png')));
assert.equal(currentTarget,null,'thumbnail capture restores the regular render target');
stage.close();stage.dispose();
console.log('3D geometry, camera picking, cutaway and attack contacts: OK');
