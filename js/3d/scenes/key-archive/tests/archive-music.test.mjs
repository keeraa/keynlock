import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchiveMusic } from '../dist/js/archive-music.js';

const positionKey = 'keynlock-archive-music-position-v1';
const volumeKey = 'keynlock-archive-music-volume-v1';
const first = 'chopin-nocturne-op9-no1.mp3';
const second = 'chopin-nocturne-op9-no2.mp3';

function setup(initial = {}) {
  const data = new Map(Object.entries(initial));
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const browser = new EventTarget();
  browser.document = new EventTarget();
  browser.Audio = class extends EventTarget {
    constructor() {
      super();
      browser.player = this;
      this.currentTime = 0;
      this.readyState = 0;
      this.paused = true;
    }
    set src(url) { this.url = url; this.currentTime = 0; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  return { browser, music: createArchiveMusic(browser, storage), data };
}

test('reload restores the saved track and playhead before the first play call', () => {
  const saved = JSON.stringify({ track: second, seconds: 43.27 });
  const { browser, music, data } = setup({ [positionKey]: saved });
  assert.equal(browser.player, undefined);
  music.start();
  const audio = browser.player;
  assert.ok(audio.url.endsWith(second));
  assert.equal(audio.currentTime, 43.27);
  assert.equal(audio.paused, false);
  browser.dispatchEvent(new Event('pagehide'));
  assert.equal(data.get(positionKey), saved);

  // Simulate a browser that defers the seek until metadata becomes available.
  audio.currentTime = 0;
  audio.duration = 250;
  audio.readyState = 1;
  audio.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(audio.currentTime, 43.27);
  audio.currentTime = 45.85;
  browser.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(JSON.parse(data.get(positionKey)), { track: second, seconds: 45.85 });
});

test('zero volume retains the playhead and a completed track saves the next track at zero', () => {
  const { browser, music, data } = setup({
    [volumeKey]: '0', [positionKey]: JSON.stringify({ track: first, seconds: 16 }),
  });
  music.start();
  assert.equal(browser.player, undefined);
  music.setVolume(40);
  const audio = browser.player;
  assert.equal(audio.volume, .4);
  assert.equal(audio.currentTime, 16);
  audio.readyState = 1;
  audio.duration = 250;
  audio.dispatchEvent(new Event('loadedmetadata'));
  audio.currentTime = 27.4;
  music.setVolume(0);
  assert.equal(audio.paused, true);
  assert.deepEqual(JSON.parse(data.get(positionKey)), { track: first, seconds: 27.4 });

  music.setVolume(40);
  audio.dispatchEvent(new Event('ended'));
  assert.ok(audio.url.endsWith(second));
  assert.deepEqual(JSON.parse(data.get(positionKey)), { track: second, seconds: 0 });
});

test('a saved track can seek through a local URL on a host without byte ranges', async () => {
  const { browser, music, data } = setup({
    [positionKey]: JSON.stringify({ track: second, seconds: 73.25 }),
  });
  const revoked = [];
  browser.URL = {
    createObjectURL: () => 'blob:music',
    revokeObjectURL: url => revoked.push(url),
  };
  let fetched;
  browser.fetch = async url => {
    fetched = url;
    return { ok: true, blob: async () => new Blob() };
  };

  music.start();
  const audio = browser.player;
  assert.equal(audio.url, undefined);
  browser.dispatchEvent(new Event('pagehide'));
  assert.equal(JSON.parse(data.get(positionKey)).seconds, 73.25);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(fetched.endsWith(second));
  assert.equal(audio.url, 'blob:music');
  assert.equal(audio.currentTime, 73.25);
  audio.dispatchEvent(new Event('ended'));
  assert.deepEqual(revoked, ['blob:music']);
  assert.ok(audio.url.endsWith('chopin-nocturne-b-flat-minor.mp3'));
});
