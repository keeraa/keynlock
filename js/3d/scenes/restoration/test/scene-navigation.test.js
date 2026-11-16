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

test('gallery camera follows the horizontal columns, focuses artwork and returns without a snap', () => {
  const previousDocument = globalThis.document;
  const previousResizeObserver = globalThis.ResizeObserver;
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {
        style: {}, hidden: false, textContent: '',
        classList: {
          add(value) { classes.add(value); },
          remove(value) { classes.delete(value); },
          contains(value) { return classes.has(value); },
        },
        setAttribute() {}, addEventListener() {},
      });
    }
    return nodes.get(id);
  };
  globalThis.document = { querySelector: node };
  globalThis.ResizeObserver = class { observe() {} };
  try {
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
    camera.position.set(0, 2.3, 7.7);
    const controls = {
      target: new THREE.Vector3(0, 1.91, 0),
      enableDamping: true, enabled: true, enableRotate: true, enablePan: false,
      minDistance: 5.25, maxDistance: 11.6, minPolarAngle: 1.23, maxPolarAngle: 1.67,
      mouseButtons: { LEFT: THREE.MOUSE.ROTATE },
      update() { camera.lookAt(this.target); },
    };
    const stage = node('.stage');
    stage.clientWidth = 1400;
    stage.clientHeight = 850;
    const sceneHost = node('#scene');
    sceneHost.clientWidth = 1400;
    sceneHost.clientHeight = 850;
    sceneHost.closest = () => stage;
    const changes = [];
    const nav = createSceneNavigation({
      THREE, camera, controls, renderer: { setSize() {} }, stage: sceneHost, easelX: 1.28,
      cartoonFilter: { resize() {} }, labelLayer: node('.painting-labels'),
      getTexture: () => ({ image: { width: 1200, height: 900 } }),
      getTool: () => null, clearUV() {}, damageHint: node('#damage-hint'),
      onWallChange: (state) => changes.push(state.mode), $: node,
    });
    nav.resize();
    const start = camera.position.clone();
    const now = performance.now();
    const galleryBounds = { minX: -15, maxX: 15, minY: 3.695, maxY: 11.85,
      width: 30, columnWidth: 2.5 };
    nav.enterWallGallery(galleryBounds);
    assert.ok(stage.classList.contains('wall-gallery-active'), 'easel overlays hide on the real stage');
    assert.ok(camera.position.distanceTo(start) < 1e-6, 'begin ascent without a snap');
    nav.animate(now + 1800);
    assert.ok(camera.position.y > 7, 'camera rises above the easels');
    assert.ok(camera.position.x < -6, 'gallery initially shows large artworks in the first columns');
    assert.equal(nav.isWallGallery(), true);
    nav.updateWallLayout({ bounds: galleryBounds, placements: [] });
    assert.equal(nav.isTraveling(), false,
      'loading thumbnails on an unchanged wall must not restart the camera flight');
    const firstX = controls.target.x;
    const firstY = controls.target.y;
    nav.moveAlongWall(1);
    nav.animate(now + 2700);
    assert.ok(controls.target.x > firstX + 5, 'the next button pans horizontally');
    assert.ok(Math.abs(controls.target.y - firstY) < 1e-6, 'horizontal navigation preserves height');
    const art = { id: 'restored-1', x: -2.4, y: 9.3, width: 1.55, height: 2.0 };
    nav.focusWallArt(art);
    nav.animate(now + 4200);
    assert.equal(nav.focusedWallId(), art.id);
    assert.ok(Math.abs(controls.target.y - art.y) < 1e-6);
    assert.ok(Math.abs(camera.position.x - art.x) < 1e-6);
    nav.updateWallLayout({ bounds: galleryBounds, placements: [art] });
    assert.equal(nav.isTraveling(), false, 'an unchanged focused frame does not restart travel');
    nav.updateWallLayout({ bounds: galleryBounds,
      placements: [{ ...art, y: art.y + .3 }] });
    assert.equal(nav.isTraveling(), true, 'the focused view tracks frame reflow');
    nav.animate(now + 5300);
    assert.ok(Math.abs(controls.target.y - (art.y + .3)) < 1e-6);
    nav.leaveWallArt();
    nav.animate(now + 5600);
    assert.equal(nav.focusedWallId(), null);
    assert.ok(Math.abs(controls.target.x - (firstX + 6)) < .1,
      'returning from a painting keeps the same column window');
    camera.position.x -= 100;
    controls.target.x -= 100;
    nav.animate(now + 5610);
    assert.ok(controls.target.x > -8,
      'dragging sideways cannot leave the exhibition wall outside the frame');
    nav.leaveWallGallery();
    assert.ok(stage.classList.contains('wall-gallery-active'), 'labels stay hidden on the way down');
    nav.animate(now + 7200);
    assert.equal(stage.classList.contains('wall-gallery-active'), false, 'labels return at the easels');
    assert.ok(camera.position.distanceTo(start) < .03, 'return to original workshop camera');
    assert.equal(controls.minPolarAngle, 1.23);
    assert.equal(controls.mouseButtons.LEFT, THREE.MOUSE.ROTATE);
    assert.deepEqual(changes, ['overview', 'art', 'overview', 'closed']);
  } finally {
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousResizeObserver;
  }
});

test('manually panning down to the easels automatically and smoothly restores workshop mode', () => {
  const previousDocument = globalThis.document;
  const previousResizeObserver = globalThis.ResizeObserver;
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { style: {}, hidden: false,
        classList: {
          add: (value) => classes.add(value), remove: (value) => classes.delete(value),
          contains: (value) => classes.has(value),
        },
        setAttribute() {}, addEventListener() {},
      });
    }
    return nodes.get(id);
  };
  globalThis.document = { querySelector: node };
  globalThis.ResizeObserver = class { observe() {} };
  try {
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
    camera.position.set(0, 2.3, 7.7);
    const controls = {
      target: new THREE.Vector3(0, 1.91, 0), enableDamping: true,
      enabled: true, enableRotate: true, enablePan: false,
      minDistance: 5.25, maxDistance: 11.6, minPolarAngle: 1.23, maxPolarAngle: 1.67,
      mouseButtons: { LEFT: THREE.MOUSE.ROTATE },
      update() { camera.lookAt(this.target); },
    };
    const stage = node('.stage');
    const sceneHost = node('#scene');
    sceneHost.clientWidth = 914;
    sceneHost.clientHeight = 1150;
    sceneHost.closest = () => stage;
    const states = [];
    const nav = createSceneNavigation({ THREE, camera, controls,
      renderer: { setSize() {} }, stage: sceneHost, easelX: 1.28,
      cartoonFilter: { resize() {} }, labelLayer: node('.painting-labels'),
      getTexture: () => ({ image: { width: 1200, height: 900 } }),
      getTool: () => null, clearUV() {}, damageHint: node('#damage-hint'),
      onWallChange: (state) => states.push(state.mode), $: node,
    });
    nav.resize();
    const originalPosition = camera.position.clone();
    const now = performance.now();
    nav.enterWallGallery({ minX: -15, maxX: 15, minY: 3.695, maxY: 11.85,
      width: 30, columnWidth: 2.5 });
    assert.ok(controls.maxDistance < 13.5, 'portrait gallery cannot zoom far away into the room');
    nav.animate(now + 1600);
    assert.ok(camera.position.z < 8, 'gallery opens close enough to the pictures');

    // Simulate the user dragging the gallery toward the easels through OrbitControls.
    let delta = 3.25 - controls.target.y;
    camera.position.y += delta;
    controls.target.y += delta;
    nav.animate(now + 1610);
    assert.equal(nav.isWallGallery(), true, 'panning near the bottom keeps the gallery active');

    delta = 2.5 - controls.target.y;
    camera.position.y += delta;
    controls.target.y += delta;
    const manualPosition = camera.position.clone();
    nav.animate(now + 1620);
    assert.equal(nav.isWallGallery(), false, 'easel mode becomes active automatically');
    assert.equal(nav.isTraveling(), true);
    assert.ok(camera.position.distanceTo(manualPosition) < 1e-6,
      'switching modes does not teleport the camera');
    nav.animate(now + 3100);
    assert.ok(camera.position.distanceTo(originalPosition) < .03);
    assert.equal(stage.classList.contains('wall-gallery-active'), false);
    assert.equal(controls.maxDistance, 11.6);
    assert.deepEqual(states, ['overview', 'closed']);
  } finally {
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousResizeObserver;
  }
});
