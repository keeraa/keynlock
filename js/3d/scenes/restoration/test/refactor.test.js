import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPaintingTextureCache } from '../src/painting-texture-cache.js';
import { createArtworkRenderer } from '../src/artwork-renderer.js';
import { applyWoodTexture, gradeWoodTexture } from '../src/wood-materials.js';
import { createWorkshopRoom } from '../src/workshop-room.js';
import { createWoodStyle } from '../src/wood-style.js';

test('painting textures are shared and least-recently-used entries are released', async () => {
  const loaded = [];
  const disposed = [];
  const cache = createPaintingTextureCache({
    THREE,
    renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
    loader: { loadAsync: async (image) => {
      loaded.push(image);
      return { dispose: () => disposed.push(image) };
    } },
    limit: 2,
  });
  const a = { image: '/a.jpg' }, b = { image: '/b.jpg' }, c = { image: '/c.jpg' };
  const first = await cache.load(a);
  assert.equal(first.colorSpace, THREE.SRGBColorSpace);
  assert.equal(first.anisotropy, 8);
  await cache.load(b);
  assert.strictEqual(await cache.load(a), first);
  await cache.load(c);
  cache.trim(c.image);
  await Promise.resolve();
  assert.deepEqual(loaded, [a.image, b.image, c.image]);
  assert.deepEqual(disposed, [b.image]);
  assert.strictEqual(await cache.load(a), first);
});

test('failed texture loads can be retried', async () => {
  let attempts = 0;
  const cache = createPaintingTextureCache({
    THREE,
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
    loader: { loadAsync: async () => {
      if (++attempts === 1) throw new Error('network unavailable');
      return { dispose() {} };
    } },
  });
  await assert.rejects(cache.load({ image: '/retry.jpg' }), /network unavailable/);
  await cache.load({ image: '/retry.jpg' });
  assert.equal(attempts, 2);
});

test('framed artwork replaces old geometry and preserves correction uniforms', () => {
  const createFrame = createArtworkRenderer({ THREE, frameWood: new THREE.MeshStandardMaterial() });
  const easel = {
    artwork: new THREE.Group(), shelf: new THREE.Group(), topClamp: new THREE.Group(),
  };
  const texture = new THREE.Texture();
  const first = createFrame(easel, texture, 1.65, 2.1);
  assert.equal(easel.artwork.children.length, 3);
  const backing = easel.artwork.children[0];
  assert.equal(backing.castShadow, true);
  assert.equal(backing.receiveShadow, true);
  assert.ok(backing.geometry.parameters.depth > 0);
  assert.ok(backing.position.z < easel.paintingMesh.position.z);
  assert.strictEqual(first.material.uniforms.uPainting.value, texture);
  assert.equal(first.material.uniforms.uSaturation.value, 1);
  let disposedGeometries = 0;
  easel.paintingMesh.geometry.addEventListener('dispose', () => disposedGeometries++);
  const second = createFrame(easel, texture, 1.7, 2.0);
  assert.equal(easel.artwork.children.length, 3);
  assert.equal(disposedGeometries, 1);
  assert.notStrictEqual(first.material, second.material);
  assert.ok(second.centerY > 0);
});

test('wood treatment keeps shared textures and tint settings', () => {
  const material = new THREE.MeshStandardMaterial();
  const texture = new THREE.Texture();
  applyWoodTexture([[material, '#c7b8a3']], texture);
  assert.strictEqual(material.map, texture);
  assert.equal(material.roughness, 1);
  assert.equal(material.metalness, 0);
  assert.strictEqual(gradeWoodTexture({ THREE, texture }), texture);
});

test('workshop factory creates the original room and two compatible easels', () => {
  const priorDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 64, height: 64,
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
      }),
    }),
  };
  try {
    const scene = new THREE.Scene();
    const material = () => new THREE.MeshStandardMaterial();
    const mats = Object.fromEntries([
      'roomWood', 'roomEdge', 'frameWood', 'easel', 'easelEdge', 'deepWood', 'metal', 'linen',
    ].map(key => [key, material()]));
    const workshop = createWorkshopRoom({ THREE, scene, mats });
    assert.ok(workshop.dust.isPoints);
    assert.equal(workshop.floorWoodMaterials.length, 38);
    assert.ok(workshop.wallpaperMaterial.isMeshStandardMaterial);
    const wallpaper = scene.children.find((object) => object.material === workshop.wallpaperMaterial);
    assert.equal(wallpaper.userData.excludeFromInk, true,
      'the wallpaper must stay free of contours at any camera zoom');
    const easel = workshop.makeEasel(-1.28, .045);
    assert.ok(easel.root.isGroup);
    assert.ok(easel.artwork.isGroup);
    assert.ok(easel.shelf.isGroup);
    assert.ok(easel.topClamp.isMesh);
    const tabletop = new THREE.Box3().setFromObject(scene.getObjectByName('restoration-worktable-top'));
    const brushPad = new THREE.Box3().setFromObject(scene.getObjectByName('restoration-brush-pad'));
    const palette = new THREE.Box3().setFromObject(scene.getObjectByName('restoration-palette'));
    assert.ok(Math.abs(palette.min.y - tabletop.max.y) < .005,
      'the paint palette rests on the wood surface');
    for (let index = 1; index <= 7; index++) {
      for (const segment of ['handle', 'ferrule']) {
        const brush = scene.getObjectByName(`restoration-brush-${index}-${segment}`);
        const bounds = new THREE.Box3().setFromObject(brush);
        assert.ok(Math.abs(bounds.min.y - brushPad.max.y) < .006,
          `brush ${index} ${segment} should touch the linen pad`);
      }
    }
  } finally {
    globalThis.document = priorDocument;
  }
});

test('new workshops select the ash finish for picture frames', async () => {
  const previousDocument = globalThis.document;
  const buttons = [0, 1, 2].map((wood) => ({
    dataset: { target: 'frame', wood: String(wood) },
    classList: { selected: false, toggle(name, selected) { if (name === 'selected') this.selected = selected; } },
    setAttribute(name, value) { if (name === 'aria-pressed') this.pressed = value; },
    addEventListener() {},
  }));
  globalThis.document = { querySelectorAll(selector) {
    return selector === '.wood-option' || selector === '.wood-option[data-target="frame"]'
      ? buttons : [];
  } };
  try {
    const material = () => new THREE.MeshStandardMaterial();
    const mats = Object.fromEntries(['easel', 'easelEdge', 'deepWood', 'frameWood',
      'roomWood', 'roomEdge'].map((key) => [key, material()]));
    const textures = new Map();
    const woodStyle = createWoodStyle({ THREE, mats,
      renderer: { capabilities: { getMaxAnisotropy: () => 8 } },
      loader: { loadAsync: async (path) => {
        const texture = new THREE.Texture();
        textures.set(path, texture);
        return texture;
      } },
      wallpaperMaterial: material(), floorWoodMaterials: [],
      variants: [0, 1, 2].map((index) => ({ image: `/finish-${index}.webp` })),
    });
    await woodStyle.initialize();
    assert.strictEqual(mats.frameWood.map, textures.get('/finish-2.webp'));
    assert.equal(buttons[2].classList.selected, true);
    assert.equal(buttons[1].classList.selected, false);
    assert.equal(buttons[2].pressed, 'true');
  } finally {
    globalThis.document = previousDocument;
  }
});
