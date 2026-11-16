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

test('wall previews cap network concurrency and cancel queued images after a reshuffle', async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const requested = new Map();
  let active = 0;
  let maxActive = 0;
  globalThis.Image = class {
    naturalWidth = 1000;
    naturalHeight = 1000;
    set src(value) {
      if (!value) return;
      active++;
      maxActive = Math.max(maxActive, active);
      requested.set(value, this);
    }
  };
  globalThis.document = { createElement: () => ({
    getContext: () => ({ fillRect() {}, drawImage() {} }),
  }) };
  try {
    const cache = createWallPreviewCache({ THREE,
      renderer: { capabilities: { getMaxAnisotropy: () => 8 } }, maxConcurrent: 2 });
    const promises = Array.from({ length: 5 }, (_, i) => cache.previewFor({ id: `p${i}`, image: `/p${i}.jpg` }));
    assert.deepEqual([...requested.keys()], ['/p0.jpg', '/p1.jpg']);
    const finish = async (path) => {
      active--;
      requested.get(path).onload();
      await new Promise((resolve) => setImmediate(resolve));
    };
    await finish('/p0.jpg');
    assert.equal(requested.has('/p2.jpg'), true, 'the next thumbnail starts when a slot is free');
    await finish('/p1.jpg');
    await finish('/p2.jpg');
    await finish('/p3.jpg');
    await finish('/p4.jpg');
    await Promise.all(promises);
    assert.equal(maxActive, 2);

    cache.clear();
    const blocker = cache.previewFor({ id: 'blocker', image: '/blocker.jpg' });
    const secondBlocker = cache.previewFor({ id: 'second-blocker', image: '/second-blocker.jpg' });
    const cancelled = cache.previewFor({ id: 'outdated', image: '/outdated.jpg' });
    cache.retain(['blocker', 'second-blocker']);
    assert.equal(await cancelled, null, 'queued obsolete thumbnails settle without loading');
    assert.equal(requested.has('/outdated.jpg'), false);
    await finish('/blocker.jpg');
    await finish('/second-blocker.jpg');
    await blocker;
    await secondBlocker;
    cache.clear();
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
});
