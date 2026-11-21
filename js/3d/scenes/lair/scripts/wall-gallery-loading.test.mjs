import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWallGallery } from '@keynlock/atelier/src/wall-gallery.js';

test('the initial exhibition resolves after every image or fallback is mounted', async () => {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  globalThis.document = {
    createElement: (name) => {
      assert.equal(name, 'canvas');
      return { width: 0, height: 0,
        getContext: () => ({ fillText() {}, fillRect() {}, drawImage() {} }) };
    },
  };
  globalThis.Image = class {
    naturalWidth = 160;
    naturalHeight = 100;
    set src(url) {
      queueMicrotask(() => {
        if (url === 'unavailable.jpg') this.onerror?.();
        else this.onload?.();
      });
    }
  };
  let gallery;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderer = { shadowMap: { needsUpdate: false },
      domElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) },
      capabilities: { getMaxAnisotropy: () => 8 } };
    gallery = createWallGallery({ THREE, scene, camera, renderer,
      frameWood: new THREE.MeshStandardMaterial() });
    const progress = [];
    const art = [
      { id: 'good', image: 'loaded.jpg', category: 'modern', title: 'One', aspect: 1 },
      { id: 'missing', image: 'unavailable.jpg', category: 'japan', title: 'Two', aspect: 1 },
    ];
    await gallery.setPaintings(art, { onProgress: (value) => progress.push(value) });
    assert.deepEqual(progress, [
      { loaded: 0, total: 2 }, { loaded: 1, total: 2 }, { loaded: 2, total: 2 },
    ]);
    assert.equal(gallery.paintingsRoot.children.length, 2);
    for (const frame of gallery.paintingsRoot.children) {
      const imageMesh = frame.children.find((child) => child.userData.galleryId);
      assert.ok(imageMesh.material.map?.isCanvasTexture,
        'all canvases, including unavailable-image fallbacks, are ready before reveal');
    }
  } finally {
    gallery?.clear();
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
  }
});
