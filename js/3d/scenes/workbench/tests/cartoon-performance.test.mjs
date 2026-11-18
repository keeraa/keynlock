import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {createCartoonFilter} from '../public/js/lab/effects/cartoon-filter.js';

test('opaque geometry reuses an identical normal pass until the scene or view changes',()=>{
  const scene=new THREE.Scene();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
  scene.add(mesh);
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);
  camera.position.set(0,0,5);camera.lookAt(0,0,0);
  const passes=[];
  let target=null;
  const renderer={
    info:{render:{calls:0,triangles:0}},
    getPixelRatio:()=>1,getRenderTarget:()=>target,
    setRenderTarget:next=>{target=next;},
    render:renderScene=>{
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      const pass=renderScene===scene?(scene.overrideMaterial?'normal':'color'):'post';
      passes.push(pass);
      renderer.info.render={calls:1,triangles:pass==='color'?12:pass==='normal'?12:2};
    }
  };
  const filter=createCartoonFilter({THREE,scene,camera,renderer});
  try{
    filter.resize(800,600);
    filter.setOptions({outline:true,outlineStrength:.85});
    const first=filter.render();
    assert.deepEqual(passes,['color','normal','post']);
    assert.equal(first.sceneTriangles,12);
    assert.equal(first.triangles,26);
    assert.equal(renderer.info.render.triangles,2,
      'reading renderer.info after postprocessing gives only the screen quad');
    passes.length=0;
    filter.render();
    assert.deepEqual(passes,['color','post'],
      'an unchanged scene uses its exact full-resolution normal texture');

    passes.length=0;mesh.position.x+=.3;
    filter.render();
    assert.deepEqual(passes,['color','normal','post']);

    passes.length=0;camera.position.x+=.15;
    filter.render();
    assert.deepEqual(passes,['color','normal','post']);

    passes.length=0;mesh.geometry.attributes.position.needsUpdate=true;
    filter.render();
    assert.deepEqual(passes,['color','normal','post']);

    passes.length=0;filter.resize(1024,768);
    filter.render();
    assert.deepEqual(passes,['color','normal','post']);

    passes.length=0;scene.remove(mesh);
    filter.render();
    assert.deepEqual(passes,['color','normal','post'],
      'removed geometry cannot leave stale normals or contours');
    passes.length=0;
    filter.render();
    assert.deepEqual(passes,['color','post']);
  }finally{
    filter.dispose();mesh.geometry.dispose();mesh.material.dispose();
  }
});
