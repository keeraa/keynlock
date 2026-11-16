import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import {createFloatingParticles,FLOATING_PARTICLE_COUNT} from '../src/js/effects/floating-particles.js';

test('flying marine snow is a single translucent depth-aware GPU draw',()=>{
  const scene=new THREE.Scene();
  const {particles,update,dispose}=createFloatingParticles({THREE,scene,pixelRatio:1.5});
  assert.equal(scene.children.length,1);
  assert.equal(particles.isPoints,true);
  assert.equal(particles.userData.atmosphere,true);
  assert.equal(particles.frustumCulled,false);
  assert.equal(particles.castShadow,false);
  assert.equal(particles.geometry.getAttribute('position').count,FLOATING_PARTICLE_COUNT);
  const attributes=['position','aSize','aSpeed','aPhase','aOpacity','aTint'];
  for(const name of attributes)
    assert.equal(particles.geometry.getAttribute(name).count,FLOATING_PARTICLE_COUNT);
  const mat=particles.material;
  assert.equal(mat.isShaderMaterial,true);
  assert.equal(mat.transparent,true);
  assert.equal(mat.depthWrite,false);
  assert.equal(mat.depthTest,true);
  assert.equal(mat.blending,THREE.NormalBlending);
  assert.equal(mat.uniforms.uPixelRatio.value,1.5);
  assert.match(mat.vertexShader,/uTime\s*\*\s*aSpeed/);
  assert.match(mat.fragmentShader,/gl_PointCoord/);
  assert.ok(Array.from(particles.geometry.getAttribute('aOpacity').array)
    .every(alpha=>alpha>.15&&alpha<.5),'dust remains unobtrusive');
  const position=particles.geometry.getAttribute('position');
  const original=position.array.slice();
  update(.5);update(.1);update(-1);
  assert.ok(Math.abs(mat.uniforms.uTime.value-.6)<1e-7);
  assert.deepEqual(position.array,original,
    'time advances in one uniform without rewriting hundreds of vertices');
  let resourcesReleased=0;
  particles.geometry.addEventListener('dispose',()=>resourcesReleased++);
  mat.addEventListener('dispose',()=>resourcesReleased++);
  dispose();
  assert.equal(scene.children.length,0);
  assert.equal(resourcesReleased,2);
});

test('dust variation is stable and independent from the puzzle RNG',()=>{
  const a=createFloatingParticles({THREE,scene:new THREE.Scene(),count:64});
  const b=createFloatingParticles({THREE,scene:new THREE.Scene(),count:64});
  const ga=a.particles.geometry,gb=b.particles.geometry;
  for(const name of ['position','aSize','aSpeed','aPhase','aOpacity','aTint']) {
    assert.deepEqual(ga.getAttribute(name).array,gb.getAttribute(name).array,
      `${name} is seeded independently of gameplay`);
    for(const value of ga.getAttribute(name).array)
      assert.ok(Number.isFinite(value));
  }
  assert.ok(ga.getAttribute('aSpeed').array.some(speed=>speed<0));
  assert.ok(ga.getAttribute('aSpeed').array.some(speed=>speed>0));
  a.dispose();b.dispose();
});
