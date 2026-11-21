import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaintingTextureCache } from '@keynlock/atelier/src/painting-texture-cache.js';

const renderer = { capabilities: { getMaxAnisotropy: () => 8 } };
const THREE = { SRGBColorSpace: 'srgb' };

test('a stalled artwork image does not indefinitely block the atelier editor', async () => {
  const paths = [];
  const cache = createPaintingTextureCache({
    THREE, renderer, timeoutMs: 20,
    loader: { loadAsync: (path) => {
      paths.push(path);
      return new Promise(() => {});
    } },
  });
  const art = { id: 'remote-work', image: 'https://example.org/slow.jpg' };
  await assert.rejects(cache.load(art), /Timed out loading artwork/);
  await assert.rejects(cache.load(art), /Timed out loading artwork/);
  assert.equal(paths.length, 2, 'a timed-out painting can be retried');
});

test('loaded pictures remain reusable and acquire correct color settings', async () => {
  let requests = 0;
  const texture = { dispose() {} };
  const cache = createPaintingTextureCache({
    THREE, renderer, timeoutMs: 500,
    loader: { async loadAsync() { requests++; return texture; } },
  });
  const art = { id: 'local', image: '/stations/atelier/paintings/vermeer-girl.jpg' };
  assert.equal(await cache.load(art), texture);
  assert.equal(await cache.load(art), texture);
  assert.equal(requests, 1);
  assert.equal(texture.colorSpace, 'srgb');
  assert.equal(texture.anisotropy, 8);
});
