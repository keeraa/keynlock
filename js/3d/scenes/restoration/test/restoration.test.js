import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRestorationStamp, RESTORATION_TOOLS } from '../src/restoration-operations.js';
import { createRestorationStore } from '../src/restoration-store.js';
import { createRestorationSessions, paintingSeed } from '../src/restoration-sessions.js';
import { createPlayerProgress } from '../src/player-progress.js';
import { createRestorationSurface, RESTORATION_SNAPSHOT_LAYERS } from '../src/restoration-surface.js';

function stamp(tool, { scanned = false, strength = .35 } = {}) {
  const erased = [];
  const marked = [];
  const changed = new Set();
  const layers = Object.fromEntries(['dust', 'dirt', 'cracks', 'loss', 'varnish', 'uvSource']
    .map(key => [key, key]));
  layers.scan = { getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, scanned ? 255 : 0]) }) };
  const affected = applyRestorationStamp({
    tool, x: 100, y: 120, width: 400, height: 300, strength, layers, changed,
    erase: (layer, x, y, radius, power) => erased.push({ layer, x, y, radius, power }),
    markUV: (x, y) => marked.push([x, y]),
  });
  return { affected, erased, marked, changed: [...changed] };
}

test('brush clears dust and light dirt; retouch covers only chipped pigment', () => {
  const brush = stamp('brush');
  assert.equal(brush.affected, true);
  assert.deepEqual(brush.changed, ['dust', 'dirt']);
  assert.deepEqual(brush.erased.map(edit => edit.power), [.82, .15]);
  const retouch = stamp('retouch');
  assert.deepEqual(retouch.changed, ['loss']);
  assert.equal(retouch.erased[0].radius, 300 * .029);
  assert.deepEqual(stamp('unknown').changed, []);
  assert.equal(RESTORATION_TOOLS.has('retouch'), true);
});

test('swab responds to slow curved motion with stronger dirt removal', () => {
  const fast = stamp('swab', { strength: .23 });
  const slow = stamp('swab', { strength: .98 });
  assert.deepEqual(fast.changed, ['dirt', 'dust']);
  assert.ok(slow.erased[0].power > fast.erased[0].power);
  assert.equal(slow.erased[1].power, .26);
});

test('UV marks the scanned area; reagent changes varnish only after UV', () => {
  const uv = stamp('uv');
  assert.deepEqual(uv.marked, [[100, 120]]);
  assert.deepEqual(uv.changed, ['uv']);
  const blocked = stamp('reagent');
  assert.equal(blocked.affected, false);
  assert.deepEqual(blocked.erased, []);
  const treated = stamp('reagent', { scanned: true });
  assert.equal(treated.affected, true);
  assert.deepEqual(treated.changed, ['varnish', 'cracks', 'uv', 'uvSource']);
  assert.deepEqual(treated.erased.map(item => item.layer), ['varnish', 'cracks', 'uvSource']);
});

test('canvas restoration restores brush edits and UV scan across a recreated surface', async () => {
  const oldDocument = globalThis.document;
  function fakeDocument() {
    let index = 0;
    return {
      createElement: () => {
        const layer = index++ % 8;
        const context = {
          alpha: layer === 7 ? 0 : 75,
          globalCompositeOperation: 'source-over',
          save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {}, clearRect() { this.alpha = 0; },
          beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {},
          bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {},
          fill() { this.alpha = this.globalCompositeOperation === 'destination-out' ? 0 : 255; },
          drawImage(image) { this.alpha = image.alpha ?? image.getContext('2d').alpha; },
          getImageData: (x, y, width, height) => {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let i = 3; i < data.length; i += 4) data[i] = context.alpha;
            return { data };
          },
        };
        return { width: 0, height: 0, getContext: () => context,
          toBlob: (callback) => callback(new Blob([String(context.alpha)], { type: 'image/png' })) };
      },
    };
  }
  const decode = async (blob) => ({ alpha: Number(await blob.text()), close() {} });
  try {
    globalThis.document = fakeDocument();
    const first = createRestorationSurface({ THREE: null, width: 2, height: 2, seed: 3 });
    const point = { x: .5, y: .5 };
    assert.equal(first.apply('reagent', point), false);
    assert.equal(first.apply('uv', point), true);
    assert.equal(first.apply('reagent', point), true);
    first.apply('brush', point);
    first.apply('retouch', point);
    const saved = await first.snapshot();
    assert.equal(Object.keys(saved.layers).length, RESTORATION_SNAPSHOT_LAYERS.length);
    assert.ok(saved.layers.scan instanceof Blob);
    assert.equal(first.isDirty(), true);

    globalThis.document = fakeDocument();
    const second = createRestorationSurface({ THREE: null, width: 2, height: 2, seed: 3 });
    assert.equal(await second.restore(saved, decode), true);
    assert.equal(second.isDirty(), false);
    assert.equal(second.apply('reagent', point), true); // UV scan was restored.
    assert.equal(await second.restore({ ...saved, width: 1 }, decode), false);
  } finally {
    globalThis.document = oldDocument;
  }
});

test('restoration snapshots are queued, preserved and not overwritten by stale writes', async () => {
  const entries = new Map();
  const commits = [];
  const adapter = {
    get: async id => entries.get(id) || null,
    put: async (id, data) => {
      await new Promise(resolve => setTimeout(resolve, data.revision === 1 ? 15 : 1));
      entries.set(id, data);
      commits.push(data.revision);
      return true;
    },
  };
  const store = createRestorationStore({ adapter });
  let revision = 1;
  let savedRevision = 0;
  let notifyCapture;
  const firstCapture = new Promise(resolve => { notifyCapture = resolve; });
  const surface = {
    isDirty: () => revision !== savedRevision,
    getRevision: () => revision,
    snapshot: async () => { notifyCapture(); return { revision }; },
    markSaved: (next) => { savedRevision = next; },
  };
  const first = store.save('girl-pearl', surface);
  await firstCapture;
  revision = 2;
  const second = store.save('girl-pearl', surface);
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.deepEqual(commits, [1, 2]);
  assert.deepEqual(await store.load('girl-pearl'), { revision: 2 });
  assert.equal(savedRevision, 2);
  assert.equal(surface.isDirty(), false);
});

test('failed snapshot write stays dirty so a later save can retry', async () => {
  let writes = 0;
  const store = createRestorationStore({
    adapter: { get: async () => null, put: async () => ++writes > 1 }, onError: () => {},
  });
  let saved = 0;
  const surface = {
    isDirty: () => saved !== 5, getRevision: () => 5,
    snapshot: async () => ({ version: 1, layers: { loss: new Blob(['damage']) } }),
    markSaved: (revision) => { saved = revision; },
  };
  assert.equal(await store.save('one', surface), false);
  assert.equal(surface.isDirty(), true);
  assert.equal(await store.save('one', surface), true);
  assert.equal(surface.isDirty(), false);
});

test('painting sessions retain 3 canvases while restoring evicted artwork', async () => {
  const persisted = new Map();
  const store = {
    load: async id => persisted.get(id) ?? null,
    save: async (id, surface) => {
      persisted.set(id, await surface.snapshot());
      surface.dirty = false;
      return true;
    },
  };
  const created = [];
  const sessions = createRestorationSessions({ THREE: null, store, limit: 3,
    makeSurface: ({ seed }) => {
      const surface = {
        seed, version: 1, unmounted: false, restored: null, dirty: true,
        isDirty() { return this.dirty; },
        unmount() { this.unmounted = true; },
        async snapshot() { return { version: this.version }; },
        async restore(data) { this.restored = data; return true; },
      };
      created.push(surface);
      return surface;
    },
  });
  const paintings = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  for (const art of paintings) {
    await sessions.get(art, 1, 1);
    sessions.trim(art.id);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sessions.cachedCount(), 3);
  assert.ok(created[0].unmounted);
  assert.equal(created[0].seed, paintingSeed('a'));
  const revisit = await sessions.get(paintings[0], 1, 1);
  assert.deepEqual(revisit.restored, { version: 1 });
});

test('an unavailable browser store cannot evict an unsaved painting', async () => {
  const store = { load: async () => null, save: async () => false };
  const sessions = createRestorationSessions({ THREE: null, store, limit: 2,
    makeSurface: () => ({ isDirty: () => true, unmount() { throw Error('Unsaved painting was discarded'); } }),
  });
  const [a, b, c] = ['a', 'b', 'c'].map(id => ({ id }));
  const first = await sessions.get(a, 1, 1);
  await sessions.get(b, 1, 1);
  await sessions.get(c, 1, 1);
  sessions.trim(c.id);
  await Promise.resolve();
  assert.equal(sessions.cachedCount(), 3);
  assert.strictEqual(await sessions.get(a, 1, 1), first);
});

test('color corrections and achievements survive reload by stable painting ID', () => {
  const memory = new Map();
  const storage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const paintings = [{ id: 'a' }, { id: 'b' }];
  const progress = createPlayerProgress({ paintings, storage });
  Object.assign(progress.state[1], { hue: 22, saturation: 127, brightness: 81,
    completed: true, surfaceComplete: true });
  progress.setSelected('b');
  const reloaded = createPlayerProgress({ paintings: [...paintings].reverse(), storage });
  assert.equal(reloaded.getSelectedIndex(), 0);
  assert.deepEqual([reloaded.state[0].hue, reloaded.state[0].saturation, reloaded.state[0].brightness], [22, 127, 81]);
  assert.equal(reloaded.state[0].surfaceComplete, true);
  assert.equal(reloaded.state[1].hue, 0);
});

test('invalid player data is ignored and out-of-range values are clamped', () => {
  const storage = {
    getItem: () => JSON.stringify({ version: 1, selectedId: 'a', settings: {
      a: { hue: 999, saturation: -100, brightness: 'bad', completed: 'true' },
    } }),
    setItem() {},
  };
  const player = createPlayerProgress({ paintings: [{ id: 'a' }], storage });
  assert.deepEqual([player.state[0].hue, player.state[0].saturation, player.state[0].brightness], [60, 50, 100]);
  assert.equal(player.state[0].completed, false);
});
