import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three-core.js';
import {createAssemblyHover} from '../public/js/lab/effects/assembly-hover.js';

test('assembly hover highlights solid contours and releases generated ribbons',()=>{
  const part=new THREE.Group();
  const metal=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,.15),
    new THREE.MeshBasicMaterial());
  part.add(metal);
  const coverFrame=new THREE.Mesh(new THREE.BoxGeometry(1,1,.05),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0}));
  coverFrame.visible=false;
  let ready=false;
  const hover=createAssemblyHover({THREE,coverFrame,canRemoveCover:()=>ready,
    getAssemblyGuidance:()=>({id:null}),canDetachPart:()=>({allowed:true}),
    getPortable:()=>({'spring-0':part}),screws:[]});
  hover.setHoveredDetachable({kind:'internal',id:'spring-0'});
  hover.animateHover(.15);
  const ribbon=metal.children.find(child=>child.userData.hoverGuide);
  assert.ok(ribbon,'generated 3D contour is attached to the actual mesh');
  assert.equal(ribbon.material.transparent,true);
  assert.ok(ribbon.material.uniforms.uOpacity.value>0);
  assert.equal(metal.material.opacity,1,'the visible metal stays fully opaque');
  hover.setHoverViewport(900,500);
  assert.equal(ribbon.material.uniforms.uViewport.value.x,900);
  ready=true;
  hover.setHoveredDetachable(null);
  hover.animateHover(.2);
  assert.ok(coverFrame.material.opacity>0,'cover edge fades in when unlocked');
  assert.equal(coverFrame.visible,true);
  hover.dispose();
  assert.equal(metal.children.includes(ribbon),false,
    'disposal detaches the helper mesh from live hardware');
});
