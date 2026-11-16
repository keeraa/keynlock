import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutWallPaintings, WALL_CAPACITY, WALL_HEIGHT, WALL_TOP, WALL_WIDTH,
  WALL_COLUMNS, WALL_COLUMN_WIDTH, WALL_HEADER_HEIGHT } from '../src/wall-layout.js';
import { createPlayerProgress } from '../src/player-progress.js';
import * as THREE from 'three';
import { createWallGallery } from '../src/wall-gallery.js';

test('twelve vertical categories stack large portraits and landscapes without overlap', () => {
  const aspects = [.44, .72, 1, 1.55, 2.6, 3.8];
  const selected = Array.from({ length: WALL_CAPACITY }, (_, index) => ({
    id: `picture-${index}`, aspect: aspects[index % aspects.length],
    category: WALL_COLUMNS[index % WALL_COLUMNS.length].id,
  }));
  const { placements, columns, bounds } = layoutWallPaintings(selected);
  assert.equal(placements.length, WALL_CAPACITY);
  assert.equal(columns.length, 12, 'one vertical column per art movement');
  assert.equal(columns.reduce((sum, column) => sum + column.count, 0), WALL_CAPACITY);
  assert.ok(bounds.minY >= WALL_TOP - WALL_HEIGHT - 1e-6);
  assert.ok(bounds.width <= WALL_WIDTH + 1e-6);
  assert.ok(placements.some((art) => art.width > art.height * 2));
  assert.ok(placements.some((art) => art.height > art.width * 1.8));
  assert.ok(placements.some((art) => art.width > 1.7), 'paintings are substantially larger');
  assert.ok(placements.some((art) => art.height > 1.7), 'portraits use the column height');
  const selectedById = new Map(selected.map((art) => [art.id, art]));
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    const source = selectedById.get(a.id);
    assert.ok(Math.abs(a.width / a.height - source.aspect) < .001, 'keep source image proportions');
    assert.equal(a.category, source.category);
    assert.equal(a.columnLabel, columns[a.columnIndex].label);
    assert.equal(a.x, columns[a.columnIndex].centerX);
    assert.ok(a.x - a.outerWidth / 2 >= -WALL_WIDTH / 2 - 1e-6);
    assert.ok(a.x + a.outerWidth / 2 <= WALL_WIDTH / 2 + 1e-6);
    assert.ok(a.y + a.outerHeight / 2 <= WALL_TOP - WALL_HEADER_HEIGHT + 1e-6);
    assert.ok(a.y - a.outerHeight / 2 >= WALL_TOP - WALL_HEIGHT - 1e-6);
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j];
      const overlapsX = Math.abs(a.x - b.x) < (a.outerWidth + b.outerWidth) / 2 + .001;
      const overlapsY = Math.abs(a.y - b.y) < (a.outerHeight + b.outerHeight) / 2 + .001;
      assert.ok(!(overlapsX && overlapsY), `${a.id} and ${b.id} overlap`);
    }
  }
  assert.ok(placements[0].x < placements.at(-1).x, 'directions appear from left to right');
  assert.ok(columns.every((column, index) => Math.abs(column.centerX - (-WALL_WIDTH / 2 + (index + .5) * WALL_COLUMN_WIDTH)) < 1e-6));
  for (const column of columns) {
    const stacked = placements.filter((art) => art.columnIndex === column.index);
    for (let index = 1; index < stacked.length; index++) {
      assert.ok(stacked[index - 1].y > stacked[index].y, 'artworks hang vertically top to bottom');
    }
  }
  const unusual = layoutWallPaintings([{ id: 'panorama', aspect: 8 }, { id: 'scroll', aspect: .12 }]).placements;
  assert.ok(Math.abs(unusual[0].width / unusual[0].height - 8) < .001);
  assert.ok(Math.abs(unusual[1].width / unusual[1].height - .12) < .001);
});

test('an overfilled category scales its own column without overlapping adjacent work', () => {
  const artworks = Array.from({ length: 30 }, (_, index) => ({
    id: `same-${index}`, aspect: .65 + (index % 6) * .5, category: 'symbolism',
  }));
  const { placements, columns } = layoutWallPaintings(artworks);
  assert.equal(columns.find((column) => column.id === 'symbolism').count, 30);
  assert.ok(placements.every((item) => item.columnLabel === 'Символизм'));
  for (let i = 0; i < placements.length - 1; i++) {
    const upper = placements[i], lower = placements[i + 1];
    assert.equal(upper.x, lower.x);
    assert.ok(upper.y - upper.outerHeight / 2 > lower.y + lower.outerHeight / 2);
  }
  assert.ok(placements.at(-1).y - placements.at(-1).outerHeight / 2 >= WALL_TOP - WALL_HEIGHT);
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
    assert.equal(wall.root.children.length, 2, 'frames and permanent headings for 12 columns');
    assert.equal(wall.paintingsRoot.children.length, 2);
    assert.equal(wall.paintingsRoot.children[0].children.length, 3, 'backing, image and frame');
    assert.equal(wall.paintingsRoot.children[0].children[0].castShadow, true);
    assert.ok(wall.root.position.z > -4.6 && wall.root.position.z < -4.5,
      'canvas backs should hang a few centimeters in front of the wall');
    assert.equal(wall.root.getObjectByName('twelve-art-history-column-headings')?.isMesh, true);
    assert.equal(renderer.shadowMap.needsUpdate, true);
    const placement = wall.getPlacement('one');
    camera.position.set(placement.x, placement.y, 1);
    camera.lookAt(placement.x, placement.y, -4.3);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    assert.equal(wall.hitTest({ clientX: 400, clientY: 400 })?.id, 'one');
    await wall.setPaintings([]);
    assert.equal(wall.paintingsRoot.children.length, 0);
    assert.equal(wall.root.children.length, 2, 'category labels remain after removing the art');
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
});
