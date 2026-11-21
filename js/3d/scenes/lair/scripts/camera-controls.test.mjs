import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
