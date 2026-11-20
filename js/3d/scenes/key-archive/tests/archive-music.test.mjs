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

test('pause filters live playback and the saved room mix uses two ceiling speakers', () => {
  const spatialKey = 'keynlock-archive-music-spatial-v1';
  const { browser, music, data } = setup({ [spatialKey]: '1' });
  const parameter = () => ({ value: 0, setTargetAtTime(value) { this.value = value; } });
  const graph = { gains: [], speakers: [] };
  const node = () => ({ connect() {} });
  browser.AudioContext = class {
    sampleRate = 12000;
    currentTime = 0;
    destination = {};
    listener = Object.fromEntries(['position', 'forward', 'up'].flatMap(name =>
      ['X', 'Y', 'Z'].map(axis => [name + axis, parameter()])));
    resume() { return Promise.resolve(); }
    createBiquadFilter() {
      return graph.filter = { ...node(), frequency: parameter(), Q: parameter() };
    }
    createGain() {
      const gain = { ...node(), gain: parameter() };
      graph.gains.push(gain);
      return gain;
    }
    createChannelSplitter() { return node(); }
    createConvolver() { return graph.room = node(); }
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: index => data[index] };
    }
    createPanner() {
      const panner = { ...node(), positionX: parameter(), positionY: parameter(), positionZ: parameter() };
      graph.speakers.push(panner);
      return panner;
    }
    createMediaElementSource() {
      graph.listener = this.listener;
      return node();
    }
  };
  music.start();
  const track = browser.player.url;
  assert.equal(music.getSpatial(), true);
  assert.equal(graph.filter.type, 'lowpass');
  assert.ok(graph.room.buffer.getChannelData(0).some(sample => sample !== 0));
  assert.ok(graph.speakers.every(speaker => speaker.panningModel === 'HRTF' && speaker.positionY.value > 10));
  assert.equal(graph.speakers.length, 2);
  browser.player.currentTime = 14;
  music.setPaused(true);
  assert.equal(graph.filter.frequency.value, 520);
  assert.equal(browser.player.paused, false);
  music.setPaused(false);
  assert.ok(graph.filter.frequency.value > 18000);
  assert.equal(browser.player.currentTime, 14);
  assert.equal(browser.player.url, track);
  music.setListener({ x: 4, y: 1.8, z: -2 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
  assert.equal(graph.listener.positionX.value, 4);
  assert.equal(graph.listener.forwardZ.value, -1);
  music.setSpatial(false);
  assert.equal(data.get(spatialKey), '0');
  assert.deepEqual(graph.gains.slice(0, 3).map(node => node.gain.value), [1, 0, 0]);
});

test('music defaults to 25 percent through ceiling speakers and honors existing preferences', () => {
  const defaults = setup().music;
  assert.equal(defaults.getVolume(), 25);
  assert.equal(defaults.getSpatial(), true);
  const saved = setup({ [volumeKey]: '71', 'keynlock-archive-music-spatial-v1': '0' }).music;
  assert.equal(saved.getVolume(), 71);
  assert.equal(saved.getSpatial(), false);
});
