import test from 'node:test';
import assert from 'node:assert/strict';
import { loadArchiveState, loadVisualSettings, saveArchiveState, saveVisualSettings } from '../dist/js/archive-persistence.js';
import { STORAGE_KEY } from '../dist/js/rules.js';

test('archive persistence preserves existing storage schema and survives unavailable storage', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const state = loadArchiveState(storage);
  assert.equal(state.keys.length, 1000);
  saveArchiveState(storage, state);
  assert.ok(data.has(STORAGE_KEY));
  assert.equal(loadArchiveState(storage).keys.length, 1000);
  const visual = loadVisualSettings(storage);
  saveVisualSettings(storage, { ...visual, toonSteps: 6 });
  assert.equal(loadVisualSettings(storage).toonSteps, 6);
  assert.doesNotThrow(() => saveArchiveState({ setItem() { throw Error('locked'); } }, state));
});
