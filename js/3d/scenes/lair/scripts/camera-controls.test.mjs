import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readFileSync } from 'node:fs';

class PointerSurface extends EventTarget {
  ownerDocument = new EventTarget();
  style = {};
  clientWidth = 1600;
  clientHeight = 1000;
  setPointerCapture() {}
  releasePointerCapture() {}
}

function fire(target, type, x, y, options = {}) {
  const event = new Event(type, {cancelable:true});
  Object.assign(event, {pointerType:'mouse',pointerId:3,button:0,
    clientX:x,clientY:y,pageX:x,pageY:y, ...options});
  target.dispatchEvent(event);
}

test('a left-button drag actually changes the Lair orbit direction', () => {
  const surface = new PointerSurface();
  const camera = new THREE.PerspectiveCamera(47, 1.6, .06, 115);
  camera.position.set(.25,8.35,31.2);
  const controls = new OrbitControls(camera,surface);
  controls.target.set(0,4.70,9.60);
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.update();
  const start = camera.position.clone();
  fire(surface,'pointerdown',400,360);
  fire(surface.ownerDocument,'pointermove',665,380);
  fire(surface.ownerDocument,'pointerup',665,380);
  controls.update();
  assert.ok(camera.position.distanceTo(start)>1,
    'drag rotates the same camera used to render the Lair');
  controls.dispose();
});

test('the Lair and preserved Atelier share one pointer surface', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const atelier=readFileSync(new URL('../../../workshops/atelier/src/main.js',import.meta.url),'utf8');
  assert.ok(html.includes('id="scene-interaction"'));
  assert.ok(main.includes('new OrbitControls(camera, interaction)'));
  assert.ok(main.includes('window.__keynlockLairInteractionElement = interaction'));
  assert.ok(atelier.includes('inputElement: embedded ? lairWindow.__keynlockLairInteractionElement'));
  assert.ok(atelier.includes('interactionCamera: embedded ? lairWindow.__keynlockLairCamera'));
});
