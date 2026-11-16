import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createWorldPuzzleEngine } from '../src/js/gameplay/world-puzzles/engine.js';
import { createWorldPuzzleStage } from '../src/js/scene/world-puzzle-stage.js';

// No GPU is required to construct and verify the interchangeable Three.js assemblies.
test('four chapter mechanisms build as finite Three.js geometry and restore the lock camera', () => {
  const document = {
    body: { classList: { add() {}, remove() {} } },
    createElement: () => ({ width: 0, height: 0, getContext: () => ({
      clearRect() {}, fillText() {},
    }) }),
  };
  const handlers = new Map();
  const canvas = {
    style: {}, addEventListener(name, callback) { handlers.set(name, callback); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(55, 4 / 3, .1, 100);
  camera.position.set(4, 3, 9);
  const original = camera.position.clone();
  const controls = { target: new THREE.Vector3(), minDistance: 3, maxDistance: 20,
    update() { camera.lookAt(this.target); camera.updateMatrixWorld(true); } };
  const palette = {};
  class MockRoundedBoxGeometry extends THREE.BoxGeometry {
    constructor(width, height, depth) { super(width, height, depth); }
  }
  for (const name of ['dark', 'steel', 'brass', 'copper', 'edge', 'key', 'inner']) {
    palette[name] = new THREE.MeshStandardMaterial({ color: 0x9da5a5 });
  }
  const commands = [];
  const stage = createWorldPuzzleStage({ THREE, RoundedBoxGeometry: MockRoundedBoxGeometry,
    document, scene, camera, controls, canvas, root, materials: palette,
    dispatch(command) { commands.push(command); } });
  const engine = createWorldPuzzleEngine({ seed: 123 });

  for (const id of ['wharf', 'keyprofile', 'pairednodes', 'museum']) {
    for (const level of [1, 2, 3]) {
      engine.start(id, level);
      stage.sync(engine.getSnapshot());
      assert.equal(root.visible, false);
      const assembly = scene.children[1];
      assert.equal(assembly.visible, true);
      let count = 0;
      assembly.traverse(object => {
        if (!object.isMesh) return;
        count++;
        const coordinates = object.geometry.getAttribute('position');
        assert.ok(coordinates && coordinates.count > 0);
        for (const [index, value] of coordinates.array.entries()) {
          assert.ok(Number.isFinite(value), `${id}/${level}: ${object.geometry.type} vertex ${index}=${value}`);
        }
      });
      assert.ok(count > 25, `${id} level ${level} assembled ${count} meshes`);
    }
  }
  // Hit the first physical museum glyph plate on the 3D board, not its HTML fallback.
  scene.updateMatrixWorld(true);
  const center = new THREE.Vector3(-.62 - 2.25, -.03 - .35, .54 + .34).project(camera);
  const point = { clientX: (center.x + 1) * 400, clientY: (1 - center.y) * 300 };
  handlers.get('pointerdown')?.(point);
  handlers.get('pointerup')?.(point);
  assert.deepEqual(commands, [{type:'world-choice',index:0}],
    'raycast of the visual glyph must dispatch the same typed command as the UI');
  engine.exit();
  stage.sync(engine.getSnapshot());
  assert.equal(root.visible, true);
  assert.ok(camera.position.distanceTo(original) < .00001);
  assert.equal(controls.maxDistance, 20);
  stage.dispose();
  assert.equal(scene.children.length, 1);
});
