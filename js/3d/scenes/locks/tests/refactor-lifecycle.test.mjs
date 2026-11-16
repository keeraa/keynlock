import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { replaceKeyProfile } from '../src/js/geometry/key-profile.js';
import { resetLockMotion } from '../src/js/gameplay/lock-state-transitions.js';
import { createRoundedPanelGeometry } from '../src/js/geometry/rounded-panel.js';
import { renderScissorPreview, disposeOwnedPreviewScene } from '../src/js/ui/preview-utils.js';
import { createEventScope } from '../src/js/ui/event-scope.js';

test('all lock reset paths share one motion reset while preserving optional wrong-key state', () => {
  const state = { insertTarget: 1, turnTarget: 1, unlockTarget: 1,
    insertP: .85, turnP: .45, unlockP: .3, wrong: true, picking: true };
  resetLockMotion(state, { clearWrong: false });
  assert.deepEqual([state.insertTarget, state.turnTarget, state.unlockTarget,
    state.insertP, state.turnP, state.unlockP], [0, 0, 0, 0, 0, 0]);
  assert.equal(state.wrong, true);
  assert.equal(state.picking, true, 'tool selection belongs to its own state transition');
  resetLockMotion(state);
  assert.equal(state.wrong, false);
});

test('key blade replacement disposes the old geometry and survives factory failure', () => {
  const events = [];
  const original = { dispose: () => events.push('old') };
  const next = { dispose: () => events.push('new') };
  const pinKey = { blade: { geometry: original } };
  assert.equal(replaceKeyProfile(pinKey, wrong => {
    events.push(wrong ? 'wrong' : 'correct');
    return next;
  }, true), next);
  assert.deepEqual(events, ['wrong', 'old']);
  assert.equal(pinKey.blade.geometry, next);
  assert.throws(() => replaceKeyProfile(pinKey, () => { throw new Error('geometry failed'); }),
    /geometry failed/);
  assert.equal(pinKey.blade.geometry, next, 'a failed profile build preserves the last valid blade');
  replaceKeyProfile(pinKey, () => next);
  assert.deepEqual(events, ['wrong', 'old'], 'a shared geometry must never be disposed twice');
});

test('both previews share the same rounded backdrop geometry generator', () => {
  const geometry = createRoundedPanelGeometry(THREE,
    { left: -2.1, bottom: -1.55, width: 4.2, height: 3.1, radius: .25 });
  geometry.computeBoundingBox();
  assert.equal(geometry.type, 'ShapeGeometry');
  assert.ok(Math.abs(geometry.boundingBox.min.x + 2.1) < 1e-6);
  assert.ok(Math.abs(geometry.boundingBox.min.y + 1.55) < 1e-6);
  assert.ok(Math.abs(geometry.boundingBox.max.y - 1.55) < 1e-6);
  assert.ok(geometry.attributes.position.count > 24);
  geometry.dispose();
});

test('shared WebGL thumbnail renderer restores the game viewport even on errors', () => {
  let throws = false;
  const renderer = { autoClear: true, info: { render: { calls: 7 } },
    setScissor(...args) { this.scissor = args; },
    setViewport(...args) { this.viewport = args; },
    setScissorTest(value) { this.scissorTest = value; },
    clearDepth() { this.depthCleared = true; },
    render() { if (throws) throw Error('WebGL failure'); },
  };
  const args = { renderer, scene: {}, camera: {},
    viewport: { x: 10, y: 20, width: 50, height: 60, visible: true },
    renderWidth: 1000, renderHeight: 700 };
  assert.deepEqual(renderScissorPreview(args), { calls: 7 });
  assert.deepEqual(renderer.scissor, [10, 20, 50, 60]);
  assert.equal(renderer.depthCleared, true);
  assert.deepEqual(renderer.viewport, [0, 0, 1000, 700]);
  assert.equal(renderer.scissorTest, false);
  assert.equal(renderer.autoClear, true);
  throws = true;
  assert.throws(() => renderScissorPreview(args), /WebGL failure/);
  assert.deepEqual(renderer.viewport, [0, 0, 1000, 700]);
  assert.equal(renderer.scissorTest, false);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderScissorPreview({ ...args, viewport: { visible: false } }), null);
});

test('event scopes remove listeners and isolated preview resources dispose once', () => {
  const callbacks = new Map();
  const target = {
    addEventListener(type, listener) { callbacks.set(type, listener); },
    removeEventListener(type, listener) {
      if (callbacks.get(type) === listener) callbacks.delete(type);
    },
  };
  const scope = createEventScope();
  scope.listen(target, 'resize', () => {});
  scope.listen(target, 'pointerenter', () => {});
  assert.equal(callbacks.size, 2);
  scope.dispose(); scope.dispose();
  assert.equal(callbacks.size, 0);

  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const disposed = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => disposed.geometry++);
  material.addEventListener('dispose', () => disposed.material++);
  texture.addEventListener('dispose', () => disposed.texture++);
  disposeOwnedPreviewScene(scene);
  assert.deepEqual(disposed, { geometry: 1, material: 1, texture: 1 });
});
