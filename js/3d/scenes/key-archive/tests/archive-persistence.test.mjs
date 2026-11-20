import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_STORAGE_KEY, loadArchiveState, openArchiveSave, loadVisualSettings, saveVisualSettings, clearArchiveState } from '../dist/js/archive-save-state-with-route.js';
import { FIRST_ROUTE_KEY_ID } from '../dist/js/first-route.js';
import { STORAGE_KEY, LEGACY_STORAGE_KEY, createInitialState, validateState, pickupKey } from '../dist/js/rules.js';

test('archive persistence preserves existing storage schema and survives unavailable storage', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const opened = openArchiveSave(storage);
  assert.equal(opened.state.keys.length, 1000);
  assert.equal(opened.save(), 'saved');
  assert.ok(data.has(STORAGE_KEY));
  assert.equal(loadArchiveState(storage).keys.length, 1000);
  const visual = loadVisualSettings(storage);
  saveVisualSettings(storage, { ...visual, toonSteps: 6 });
  assert.equal(loadVisualSettings(storage).toonSteps, 6);
  assert.equal(openArchiveSave(null).save(), 'unavailable');
});

test('saved keys in removed baths survive loading and keep their processing timer', () => {
  const state = createInitialState();
  const muddy = state.keys.find(key => key.mud);
  muddy.status = 'bath';
  muddy.bathId = 'near-mud';
  muddy.bathUntil = Date.now() + 30000;
  const storage = { getItem: key => key === STORAGE_KEY ? JSON.stringify(state) : null };
  const loaded = loadArchiveState(storage);
  const restored = loaded.keys.find(key => key.id === muddy.id);
  assert.equal(restored.status, 'bath');
  assert.equal(restored.bathId, 'center-mud');
  assert.equal(restored.bathUntil, muddy.bathUntil);
  assert.equal(validateState(loaded), true);
});

test('an unreadable legacy snapshot cannot replace a valid current save', () => {
  const state = createInitialState();
  pickupKey(state, state.keys[0].id);
  const data = new Map([[STORAGE_KEY, JSON.stringify(state)], [LEGACY_STORAGE_KEY, '{']]);
  const storage = { getItem: key => data.get(key) ?? null };
  const loaded = loadArchiveState(storage);
  assert.deepEqual(loaded.held, state.held);
  assert.equal(loaded.firstRoute, false);
  const starter = archive => archive.keys.find(key => key.id === FIRST_ROUTE_KEY_ID);
  const withoutRoute = loadArchiveState({ getItem: key => key === STORAGE_KEY
    ? JSON.stringify({ ...state, firstRoute: false }) : null });
  assert.deepEqual(starter(loaded), starter(withoutRoute));
});

test('an impossible cabinet count can recover from a legacy save, and reset clears both formats', () => {
  const current = createInitialState();
  for (const key of current.keys.slice(0, 97)) key.status = 'sorted';
  const legacy = { version: 1, keys: createInitialState().keys.slice(0, 80), held: [] };
  legacy.keys[0].status = 'sorted';
  const data = new Map([[STORAGE_KEY, JSON.stringify(current)], [LEGACY_STORAGE_KEY, JSON.stringify(legacy)]]);
  const storage = { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) };
  assert.equal(loadArchiveState(storage).keys.filter(key => key.status === 'sorted').length, 1);
  clearArchiveState(storage);
  assert.equal(loadArchiveState(storage).keys.every(key => key.status === 'floor'), true);
});

function memoryStorage(data, failing = () => false) {
  return {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) {
      if (failing(key)) throw new Error('storage unavailable');
      data.set(key, value);
    },
    removeItem: key => data.delete(key),
  };
}

test('a corrupt primary restores the latest backup, including held keys and a soaking timer', () => {
  const data = new Map();
  const storage = memoryStorage(data);
  const { state, save } = openArchiveSave(storage);
  const muddy = state.keys.find(key => key.mud && !key.broken);
  Object.assign(muddy, { status: 'bath', bathId: 'center-mud', bathUntil: Date.now() + 30000 });
  const held = state.keys.find(key => key.status === 'floor');
  pickupKey(state, held.id);
  assert.equal(save(), 'saved');
  const backup = data.get(BACKUP_STORAGE_KEY);
  data.set(STORAGE_KEY, '{');
  const restored = openArchiveSave(storage);
  assert.equal(restored.recovered, true);
  assert.deepEqual(restored.state.held, [held.id]);
  assert.equal(restored.state.keys.find(key => key.id === muddy.id).bathUntil, muddy.bathUntil);
  assert.equal(data.get(STORAGE_KEY), '{');
  assert.equal(restored.save(), 'saved');
  assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)).held, [held.id]);
  assert.deepEqual(JSON.parse(data.get(BACKUP_STORAGE_KEY)).held, JSON.parse(backup).held);
  clearArchiveState(storage);
  assert.equal(data.has(BACKUP_STORAGE_KEY), false);
  assert.equal(data.has(STORAGE_KEY), false);
});

test('failed writes preserve committed progress and can be retried', () => {
  const data = new Map();
  let failingKey = null;
  const storage = memoryStorage(data, key => key === failingKey);
  const opened = openArchiveSave(storage);
  assert.equal(opened.save(), 'saved');
  const first = data.get(STORAGE_KEY);
  assert.equal(data.get(BACKUP_STORAGE_KEY), first);
  pickupKey(opened.state, opened.state.keys[0].id);
  failingKey = STORAGE_KEY;
  assert.equal(opened.save(), 'write-error');
  assert.equal(data.get(STORAGE_KEY), first);
  assert.equal(data.get(BACKUP_STORAGE_KEY), first);
  failingKey = BACKUP_STORAGE_KEY;
  assert.equal(opened.save(), 'backup-error');
  assert.notEqual(data.get(STORAGE_KEY), first);
  assert.equal(data.get(BACKUP_STORAGE_KEY), first);
  failingKey = null;
  assert.equal(opened.save(), 'saved');
  assert.equal(data.get(BACKUP_STORAGE_KEY), data.get(STORAGE_KEY));
});

test('unrecoverable data and updates from another open session are left intact', () => {
  const corrupt = new Map([[STORAGE_KEY, '{'], [BACKUP_STORAGE_KEY, 'null']]);
  assert.equal(openArchiveSave(memoryStorage(corrupt)).save(), 'damaged');
  assert.deepEqual([...corrupt.values()], ['{', 'null']);
  const data = new Map();
  const storage = memoryStorage(data);
  const first = openArchiveSave(storage);
  const second = openArchiveSave(storage);
  pickupKey(second.state, second.state.keys[0].id);
  assert.equal(second.save(), 'saved');
  assert.equal(first.save(), 'conflict');
  assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)).held, second.state.held);
});
