import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {createProjectedBoundsCache} from '../public/js/scene-picking-bounds.js';

test('small-part screen bounds reuse projections until camera or geometry changes',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,.04,100);
  camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const geometry=new THREE.BoxGeometry(.08,.12,.1);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  const rect={width:400,height:400};
  const cache=createProjectedBoundsCache({THREE,camera});
  const originalProject=THREE.Vector3.prototype.project;
  let projected=0;
  THREE.Vector3.prototype.project=function(...args){
    projected++;return originalProject.apply(this,args);
  };
  try{
    const first=cache.get(mesh,rect);
    assert.ok(first&&first.center instanceof THREE.Vector3);
    assert.equal(projected,8);
    assert.equal(cache.get(mesh,rect),first,'stationary bounds reuse the cached result');
    assert.equal(projected,8);

    mesh.position.x+=.22;
    const moved=cache.get(mesh,rect);
    assert.notEqual(moved,first);
    assert.ok(moved.xMin>first.xMin);
    assert.equal(projected,16);

    camera.position.x+=.3;camera.updateMatrixWorld();
    cache.get(mesh,rect);
    assert.equal(projected,24);

    geometry.attributes.position.needsUpdate=true;
    cache.get(mesh,rect);
    assert.equal(projected,32);

    cache.get(mesh,{width:480,height:400});
    assert.equal(projected,40,'resizing invalidates all screen-space coordinates');
  }finally{
    THREE.Vector3.prototype.project=originalProject;
    geometry.dispose();mesh.material.dispose();
  }
});
