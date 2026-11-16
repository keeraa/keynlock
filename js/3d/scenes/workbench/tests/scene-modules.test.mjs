import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {cutLayout,BREAK_CUT} from '../public/js/logic.js';
import {createScenePicking} from '../public/js/scene-picking.js';
import {disposeSceneResources} from '../public/js/scene-disposal.js';
import {shouldRebuildTargetGuide,targetGuideGeometry} from '../public/js/key-guide.js';
import {zoneSurfaceSamples,createZoneFaceGeometry,createZoneRimGeometry,
  createZoneOutlineGeometry} from '../public/js/key-zone-highlight.js';

test('3D pointer picking selects the intended tooth and refuses a broken blank',()=>{
  const layout=cutLayout(4),cuts=Array(4).fill(0);
  const camera=new THREE.PerspectiveCamera(40,1,.04,100);
  camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const blankRoot=new THREE.Group(),keyRoot=new THREE.Group(),assemblyRoot=new THREE.Group();
  const canvas={getBoundingClientRect:()=>({left:0,top:0,width:400,height:400})};
  const hitObjects=[];
  const picker=createScenePicking({THREE,canvas,camera,blankRoot,keyRoot,
    assemblyRoot,hitObjects,getLayout:()=>layout,getCuts:()=>cuts});
  const point=new THREE.Vector3(layout[2].center,0,.112).project(camera);
  const x=(point.x+1)*200,y=(1-point.y)*200;
  const picked=picker.keyPointer(x,y);
  assert.ok(picked);
  assert.equal(picked.back,false);
  assert.ok(Math.abs(picked.point.x-layout[2].center)<1e-5);
  assert.deepEqual(picker.hitTest(x,y),{kind:'cut',index:2});
  cuts[2]=BREAK_CUT;
  assert.equal(picker.hitTest(x,y),null);

  keyRoot.visible=false;
  const part=new THREE.Mesh(new THREE.SphereGeometry(.2),new THREE.MeshBasicMaterial());
  part.userData={kind:'part',id:'pin-2'};
  assemblyRoot.add(part);hitObjects.push(part);
  assemblyRoot.updateMatrixWorld(true);
  assert.deepEqual(picker.hitTest(200,200),{kind:'part',id:'pin-2'});
  part.geometry.dispose();part.material.dispose();
});

test('hidden manual guides defer geometry rebuild until guided mode returns',()=>{
  assert.equal(shouldRebuildTargetGuide('guided',true,'b','a'),true);
  assert.equal(shouldRebuildTargetGuide('guided',true,'a','a'),false);
  assert.equal(shouldRebuildTargetGuide('soap',true,'b','a'),false);
  assert.equal(shouldRebuildTargetGuide('imprint',true,'b','a'),false);
  assert.equal(shouldRebuildTargetGuide('guided',false,'b','a'),false);
  const layout=cutLayout(4),targets=[.05,.12,.19,.26];
  const guide=targetGuideGeometry(THREE,[0,0,0,0],targets,layout);
  assert.ok(guide.getAttribute('position').count>10);
  guide.dispose();
});

test('one sampled tooth contour produces exactly the same face, rim, outline',()=>{
  const cuts=[.10,.05,.20,.08],layout=cutLayout(4),i=2;
  const samples=zoneSurfaceSamples(cuts,layout,i);
  for(const build of [createZoneFaceGeometry,createZoneRimGeometry,createZoneOutlineGeometry]){
    const original=build(THREE,cuts,layout,i);
    const reused=build(THREE,cuts,layout,i,[],samples);
    assert.deepEqual(Array.from(original.getAttribute('position').array),
      Array.from(reused.getAttribute('position').array));
    original.dispose();reused.dispose();
  }
});

test('teardown releases shared geometry, material and texture only once',()=>{
  const root=new THREE.Group();
  const geometry=new THREE.BoxGeometry(1,1,1);
  const texture=new THREE.Texture();
  const material=new THREE.MeshBasicMaterial({map:texture});
  root.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const counts={geometry:0,material:0,texture:0};
  geometry.addEventListener('dispose',()=>counts.geometry++);
  material.addEventListener('dispose',()=>counts.material++);
  texture.addEventListener('dispose',()=>counts.texture++);
  assert.deepEqual(disposeSceneResources(root),{geometries:1,materials:1,textures:1});
  assert.deepEqual(counts,{geometry:1,material:1,texture:1});
});
