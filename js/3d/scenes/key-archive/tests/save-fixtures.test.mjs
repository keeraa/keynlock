import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { openArchiveSave, BACKUP_STORAGE_KEY } from '../dist/js/archive-save-state-with-route.js';
import { STORAGE_KEY } from '../dist/js/rules.js';
import { SAVE_REVISION, isNewerSave, migrateSave } from '../dist/js/save-revisions.js';

const DIR = new URL('./fixtures/saves/', import.meta.url);
// Saves written by earlier published builds (see fixtures/saves/make-save.mjs).
const fixtures = readdirSync(DIR).filter(name => name.endsWith('.json.gz'))
  .map(name => ({ name, raw: gunzipSync(readFileSync(new URL(name, DIR))).toString('utf8') }));

const memoryStorage = entries => {
  const data = new Map(entries);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const count = (state, status) => state.keys.filter(key => key.status === status).length;

test('there are save fixtures from earlier builds', () => {
  assert.ok(fixtures.length >= 3);
});

for (const { name, raw } of fixtures) {
  test(`a save from build ${name.replace('.json.gz', '')} opens with its progress intact`, () => {
    const before = JSON.parse(raw);
    const storage = memoryStorage([[STORAGE_KEY, raw]]);
    const opened = openArchiveSave(storage);
    const state = opened.state;
    assert.equal(opened.recovered, false, 'loaded as the primary save, not a fallback');
    assert.equal(count(state, 'sorted'), count(before, 'sorted'));
    assert.deepEqual(state.held, before.held);
    assert.equal(count(state, 'bath'), count(before, 'bath'));
    for (const key of before.keys.filter(key => key.status === 'sorted'))
      assert.equal(state.keys.find(other => other.id === key.id).status, 'sorted', key.id);
    assert.equal(state.revision, SAVE_REVISION);
    assert.equal(opened.save(), 'saved');
    const written = JSON.parse(storage.data.get(STORAGE_KEY));
    assert.equal(written.revision, SAVE_REVISION);
    assert.equal(count(written, 'sorted'), count(before, 'sorted'));
  });
}

test('a save from a newer build is neither loaded, overwritten nor called damaged', () => {
  const newer = JSON.parse(fixtures.at(-1).raw);
  newer.revision = SAVE_REVISION + 1;
  const raw = JSON.stringify(newer);
  const storage = memoryStorage([[STORAGE_KEY, raw], [BACKUP_STORAGE_KEY, raw]]);
  const opened = openArchiveSave(storage);
  assert.equal(opened.save(), 'newer');
  assert.equal(storage.data.get(STORAGE_KEY), raw);
  assert.equal(storage.data.get(BACKUP_STORAGE_KEY), raw);
  assert.ok(isNewerSave({ version: 3, keys: [] }));
  assert.ok(!isNewerSave({ version: 2 }));
});

test('migrations run once per revision and stamp the current one', () => {
  const state = migrateSave({ version: 2 });
  assert.equal(state.revision, SAVE_REVISION);
  assert.equal(migrateSave(state).revision, SAVE_REVISION);
});
