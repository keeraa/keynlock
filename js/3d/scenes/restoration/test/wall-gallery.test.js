import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutWallPaintings, WALL_CAPACITY, WALL_HEIGHT, WALL_TOP, WALL_WIDTH } from '../src/wall-layout.js';
import { createPlayerProgress } from '../src/player-progress.js';
import * as THREE from 'three';
import { createWallGallery } from '../src/wall-gallery.js';

test('mixed portrait, landscape and panoramic paintings pack tightly without overlap', () => {
  const aspects = [.44, .72, 1, 1.55, 2.6, 3.8];
  const selected = Array.from({ length: WALL_CAPACITY }, (_, index) => ({
    id: `picture-${index}`, aspect: aspects[index % aspects.length],
  }));
  const { placements, bounds } = layoutWallPaintings(selected);
  assert.equal(placements.length, WALL_CAPACITY);
  assert.ok(bounds.minY >= WALL_TOP - WALL_HEIGHT - 1e-6);
  assert.ok(bounds.width <= WALL_WIDTH + 1e-6);
  assert.ok(placements.some((art) => art.width > art.height * 2));
  assert.ok(placements.some((art) => art.height > art.width * 1.8));
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    assert.ok(Math.abs(a.width / a.height - selected[i].aspect) < .001, 'keep source image proportions');
    assert.ok(a.x - a.outerWidth / 2 >= -WALL_WIDTH / 2 - 1e-6);
    assert.ok(a.x + a.outerWidth / 2 <= WALL_WIDTH / 2 + 1e-6);
    assert.ok(a.y + a.outerHeight / 2 <= WALL_TOP + 1e-6);
    assert.ok(a.y - a.outerHeight / 2 >= WALL_TOP - WALL_HEIGHT - 1e-6);
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j];
      const overlapsX = Math.abs(a.x - b.x) < (a.outerWidth + b.outerWidth) / 2 + .15;
      const overlapsY = Math.abs(a.y - b.y) < (a.outerHeight + b.outerHeight) / 2 + .15;
      assert.ok(!(overlapsX && overlapsY), `${a.id} and ${b.id} overlap`);
    }
  }
  assert.ok(placements[0].y > placements.at(-1).y, 'the wall fills from the top downward');
  const unusual = layoutWallPaintings([{ id: 'panorama', aspect: 8 }, { id: 'scroll', aspect: .12 }]).placements;
  assert.ok(Math.abs(unusual[0].width / unusual[0].height - 8) < .001);
  assert.ok(Math.abs(unusual[1].width / unusual[1].height - .12) < .001);
});

test('wall retains only 30 fully restored favorites and remembers manual selection', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const paintings = Array.from({ length: 33 }, (_, index) => ({ id: `p${index}` }));
  const player = createPlayerProgress({ paintings, storage });
  player.state[0].completed = true;
  assert.equal(player.autoPin('p0'), false, 'color alone is insufficient');
  player.state[0].surfaceComplete = true;
  assert.equal(player.autoPin('p0'), true);
  for (let i = 1; i < 33; i++) {
    player.state[i].completed = player.state[i].surfaceComplete = true;
    player.autoPin(`p${i}`);
  }
  assert.equal(player.getWallIds().length, 30);
  assert.equal(player.toggleWall('p30').reason, 'full');
  assert.deepEqual(player.toggleWall('p4'), { changed: true, onWall: false });
  assert.deepEqual(player.toggleWall('p30'), { changed: true, onWall: true });
  assert.equal(player.getWallIds().at(-1), 'p30');
  const reopened = createPlayerProgress({ paintings, storage });
  assert.deepEqual(reopened.getWallIds(), player.getWallIds());
  reopened.state[30].surfaceComplete = false;
  reopened.removeFromWall('p30');
  assert.equal(reopened.getWallIds().includes('p30'), false);
});

test('existing restoration saves migrate into the wall without resetting their progress', () => {
  const storage = {
    getItem: () => JSON.stringify({ version: 1, selectedId: 'b', settings: {
      a: { completed: true, surfaceComplete: true },
      b: { completed: true, surfaceComplete: false },
    } }),
    setItem() {},
  };
  const progress = createPlayerProgress({ paintings: [{ id: 'a' }, { id: 'b' }], storage });
  assert.deepEqual(progress.getWallIds(), ['a']);
  assert.equal(progress.state[1].completed, true);
});

test('wall creates real framed meshes and allows selecting a mixed-size image', async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  globalThis.Image = class {
    naturalWidth = 1200;
    naturalHeight = 800;
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
  };
  globalThis.document = { createElement: () => ({
    width: 480, height: 480,
    getContext: () => ({ fillRect() {}, drawImage() {}, set fillStyle(value) { this.color = value; } }),
  }) };
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 65);
    const renderer = {
      domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) },
      shadowMap: { needsUpdate: false }, capabilities: { getMaxAnisotropy: () => 8 },
    };
    const wall = createWallGallery({ THREE, scene, camera, renderer, frameWood: new THREE.MeshStandardMaterial() });
    await wall.setPaintings([{ id: 'one', image: '/one.jpg', title: 'First' },
      { id: 'two', image: '/two.jpg', title: 'Second' }]);
    assert.equal(wall.root.children.length, 2);
    assert.equal(wall.root.children[0].children.length, 3, 'backing, image and frame');
    assert.equal(wall.root.children[0].children[0].castShadow, true);
    assert.equal(renderer.shadowMap.needsUpdate, true);
    const placement = wall.getPlacement('one');
    camera.position.set(placement.x, placement.y, 1);
    camera.lookAt(placement.x, placement.y, -4.3);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    assert.equal(wall.hitTest({ clientX: 400, clientY: 400 })?.id, 'one');
    await wall.setPaintings([]);
    assert.equal(wall.root.children.length, 0);
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
});
