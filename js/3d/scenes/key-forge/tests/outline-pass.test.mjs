import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { ScreenSpaceOutlinePass } from '../dist/js/outline-pass.js';

test('единая экранная обводка строится по глубине и нормалям, сохраняя настройки рендера', () => {
  const renderer = {
    shadowMap: { enabled: true },
    toneMapping: THREE.ACESFilmicToneMapping,
    autoClear: true,
    target: null,
    clearColor: new THREE.Color('#f9e6b6'),
    clearAlpha: 0,
    calls: [],
    getRenderTarget() { return this.target; },
    setRenderTarget(target) { this.target=target; },
    getClearColor(target) { return target.copy(this.clearColor); },
    getClearAlpha() { return this.clearAlpha; },
    setClearColor(color,alpha) { this.clearColor.set(color);this.clearAlpha=alpha; },
    render(scene) {
      this.calls.push({scene,target:this.target,override:scene.overrideMaterial,
        shadow:this.shadowMap.enabled,autoClear:this.autoClear,
        planeVisible:plane.visible,decorationVisible:decoration.visible,dirtVisible:dirt.visible});
    },
  };
  const pass=new ScreenSpaceOutlinePass(renderer);
  pass.setSize(960,540,1.5);
  assert.deepEqual(pass.compositeMaterial.uniforms.uTexel.value.toArray(),[1/960,1/540]);
  assert.equal(pass.compositeMaterial.uniforms.uRadius.value,1.55*1.5);
  assert.match(pass.compositeMaterial.fragmentShader,/uDepth/);
  assert.match(pass.compositeMaterial.fragmentShader,/uNormals/);

  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera();
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1));
  scene.add(plane);
  const decoration=new THREE.Mesh(new THREE.PlaneGeometry(.1,.1));
  decoration.userData.exportable=false;
  scene.add(decoration);
  const dirt=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2));
  dirt.userData.exportable=false;
  dirt.userData.outlineable=true;
  scene.add(dirt);
  const originalClear=renderer.clearColor.clone();
  pass.render(scene,camera,plane);

  assert.equal(renderer.calls.length,3);
  assert.equal(renderer.calls[0].override,pass.normalMaterial);
  assert.equal(renderer.calls[0].target,pass.target);
  assert.equal(renderer.calls[0].planeVisible,false);
  assert.equal(renderer.calls[0].decorationVisible,false);
  assert.equal(renderer.calls[0].dirtVisible,true);
  assert.equal(renderer.calls[0].shadow,false);
  assert.equal(renderer.calls[1].override,null);
  assert.equal(renderer.calls[1].target,null);
  assert.equal(renderer.calls[1].planeVisible,true);
  assert.equal(renderer.calls[1].decorationVisible,true);
  assert.equal(renderer.calls[1].dirtVisible,true);
  assert.equal(renderer.calls[1].shadow,true);
  assert.equal(renderer.calls[2].scene,pass.compositeScene);
  assert.equal(renderer.calls[2].autoClear,false);
  assert.equal(renderer.autoClear,true);
  assert.equal(renderer.target,null);
  assert.equal(renderer.shadowMap.enabled,true);
  assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);
  assert.equal(renderer.clearColor.getHex(),originalClear.getHex());
  assert.equal(plane.visible,true);
  assert.equal(decoration.visible,true);
  assert.equal(dirt.visible,true);
  pass.dispose();
  plane.geometry.dispose();
  decoration.geometry.dispose();
  dirt.geometry.dispose();
});
