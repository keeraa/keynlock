import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallPreviewCache } from '../src/wall-preview-cache.js';

test('wall previews reuse textures and dispose evicted images exactly once', async () => {
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  let imageLoads = 0;
  globalThis.Image = class {
    naturalWidth = 1200;
    naturalHeight = 800;
    set src(value) {
      if (!value) return;
      imageLoads++;
      queueMicrotask(() => this.onload?.());
    }
  };
  globalThis.document = { createElement: () => ({
    getContext: () => ({ fillRect() {}, drawImage() {} }),
  }) };
  try {
    const cache = createWallPreviewCache({ THREE,
      renderer: { capabilities: { getMaxAnisotropy: () => 8 } } });
    const art = { id: 'art-1', image: '/art-1.jpg' };
    const first = cache.previewFor(art);
    assert.strictEqual(cache.previewFor(art), first);
    const { texture, aspect } = await first;
    assert.equal(aspect, 1.5);
    assert.equal(imageLoads, 1);
    let disposals = 0;
    texture.addEventListener('dispose', () => { disposals++; });
    cache.retain(['art-1']);
    assert.equal(disposals, 0);
    cache.clear();
    await Promise.resolve();
    assert.equal(disposals, 1);
    const next = cache.previewFor(art);
    assert.notStrictEqual(next, first, 'a removed preview is loaded anew');
    await next;
    assert.equal(imageLoads, 2);
    cache.clear();
  } finally {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
  }
});
