import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSceneNavigation } from '../src/scene-navigation.js';

test('painting focus eases into place without a camera snap, even after a resize', () => {
  const originalDocument = globalThis.document;
  const originalResizeObserver = globalThis.ResizeObserver;
  const nodes = new Map();
  function getNode(key) {
    if (!nodes.has(key)) nodes.set(key, {
      style: {}, hidden: false, textContent: '',
      classList: { add() {}, remove() {} },
      setAttribute() {}, addEventListener() {},
    });
    return nodes.get(key);
  }
  globalThis.document = { querySelector: getNode };
  globalThis.ResizeObserver = class { observe() {} };

  try {
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
    const controls = {
      target: new THREE.Vector3(0, 1.91, 0),
      enableDamping: true,
      enabled: true,
      minPolarAngle: 1.23,
      maxPolarAngle: 1.67,
      minDistance: 5.25,
      pendingDelta: 0,
      update() {
        if (!this.enableDamping) {
          camera.position.x += this.pendingDelta;
          this.pendingDelta = 0;
        }
        const offset = camera.position.clone().sub(this.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.phi = THREE.MathUtils.clamp(spherical.phi, this.minPolarAngle, this.maxPolarAngle);
        camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(spherical));
        camera.lookAt(this.target);
        return true;
      },
    };
    const stage = getNode('.stage');
    stage.clientWidth = 1250;
    stage.clientHeight = 800;
    const navigation = createSceneNavigation({
      THREE, camera, controls, renderer: { setSize() {} }, stage, easelX: 1.28,
      cartoonFilter: { resize() {} }, labelLayer: getNode('.painting-labels'),
      getTexture: () => ({ image: { naturalWidth: 1800, naturalHeight: 1000 } }),
      getTool: () => null, clearUV() {}, damageHint: getNode('#damage-hint'),
      $: getNode,
    });
    navigation.setPaintingCenterY(2.52); // A wide painting, higher than a portrait.
    navigation.resize();
    const before = camera.position.clone();

    // Simulate residual OrbitControls inertia left by the last mouse action.
    controls.pendingDelta = .3;
    const now = performance.now();
    navigation.focusOn('copy');
    assert.ok(camera.position.distanceTo(before) < 1e-6, 'camera should not jump on click');
    assert.equal(navigation.isTraveling(), true);

    navigation.animate(now + 16);
    assert.ok(camera.position.distanceTo(before) < .02, 'the first frame should ease in slowly');
    const inFlight = camera.position.clone();
    stage.clientWidth = 1120;
    navigation.resize();
    assert.equal(navigation.isTraveling(), true, 'layout change must not cancel camera flight');
    assert.ok(camera.position.distanceTo(inFlight) < 1e-6);

    navigation.animate(now + 1200);
    assert.equal(navigation.isTraveling(), false);
    assert.equal(controls.enabled, true);
    const polar = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)).phi;
    assert.ok(polar < controls.maxPolarAngle - .01, 'arrival should not trigger polar-angle clamping');
    assert.ok(Math.abs(camera.position.x - 1.28) < 1e-6);
  } finally {
    globalThis.document = originalDocument;
    globalThis.ResizeObserver = originalResizeObserver;
  }
});
