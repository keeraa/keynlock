import { loadArchiveState } from '../dist/js/archive-save-state-with-route.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, KEY_TYPES, TOTAL_KEYS, KEYS_PER_TYPE, MAX_HELD, createInitialState, createInitialKeys,
  validateState, migrateLegacyState, pickupKey, selectedKey, putKeyInCabinet,
  trashSelectedKey, upgradeKeyConditions, dropSelectedKey, getProgress,
  MUD_ORDINALS, RUST_ORDINALS, BOTH_ORDINALS, keyCondition,
  startSoak, bathContents, collectSoakedKey, meltSelectedWax, buyBundle, putBundleInCabinet,
  FLOOR_DISTRIBUTION_VERSION, upgradeFloorDistribution, upgradeStationBaths,
} from '../dist/js/rules.js';
import {
  sampleThrow, throwFlightTime, THROW_FIRST_BOUNCE_SECONDS, THROW_SECOND_BOUNCE_SECONDS,
  THROW_BOUNCE_SECONDS, THROW_SLIDE_SECONDS,
} from '../dist/js/throw-physics.js';
import { separateFloorKeys, findFreeFloorSpot, KEY_CLEARANCE } from '../dist/js/key-spacing.js';
import {
  CABINET_GRID_HALF_WIDTH, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS, CABINET_BACK_FRONT_Z, CABINET_GROUND_OFFSET,
  CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_SHELF_DEPTH,
  CABINET_SHELF_CENTER_Z, CABINET_GRID_BOTTOM_Y, CABINET_GRID_TOP_Y,
  CABINET_BLANK_ROW_BOTTOM_Y,
  CABINET_OUTLINE, pegForSlot, cabinetKeyPose,
} from '../dist/js/cabinet-layout.js';
import { STATIONS, BATH_CAPACITY, SOAK_SECONDS, bathId, inStationFootprint } from '../dist/js/station-layout.js';
import { HALL_FLOOR_TOP, RUG_TOP, floorSurfaceY, restingKeyY } from '../dist/js/floor-contact.js';

test('ten distinct families and repeatable key distribution', () => {
  assert.equal(KEY_TYPES.length, 10);
  assert.equal(new Set(KEY_TYPES.map(type => type.id)).size, 10);
  assert.equal(KEYS_PER_TYPE, 100);
  assert.equal(TOTAL_KEYS, 1000);
  assert.deepEqual(createInitialKeys(), createInitialKeys());
  assert.equal(validateState(createInitialState()), true);
  assert.equal(getProgress(createInitialState()).floorCount, 1000);
  assert.equal(getProgress(createInitialState()).broken, 40);
  assert.equal(getProgress(createInitialState()).required.reduce((total, count) => total + count), 960);
});

test('all ten families are mixed across the floor instead of clustered by type', () => {
  const keys = createInitialKeys();
  separateFloorKeys(keys);
  for (let type = 0; type < KEY_TYPES.length; type++) {
    const family = keys.filter(key => key.type === type);
    const span = Math.max(...family.map(key => key.z)) - Math.min(...family.map(key => key.z));
    assert.ok(span > 30, `Семейство ${type} занимает только ${span.toFixed(1)} м`);
  }
  let nearestSameType = 0;
  for (const key of keys) {
    let best = Infinity;
    let nearestType = null;
    for (const other of keys) {
      if (other === key) continue;
      const distSq = (key.x - other.x) ** 2 + (key.z - other.z) ** 2;
      if (distSq < best) { best = distSq; nearestType = other.type; }
    }
    if (nearestType === key.type) nearestSameType++;
  }
  assert.ok(nearestSameType < keys.length * .18,
    `Слишком много одинаковых соседей: ${nearestSameType} из ${keys.length}`);
});

test('old saves redistribute only keys still on the floor and keep progress', () => {
  const state = createInitialState();
  state.floorDistributionVersion = 1;
  const sorted = state.keys[0];
  const held = state.keys[1];
  sorted.status = 'sorted';
  held.status = 'held';
  state.held.push(held.id);
  const originals = [sorted.x, sorted.z, held.x, held.z];
  assert.equal(upgradeFloorDistribution(state), 998);
  assert.equal(state.floorDistributionVersion, FLOOR_DISTRIBUTION_VERSION);
  assert.deepEqual([sorted.x, sorted.z, held.x, held.z], originals);
  assert.equal(upgradeFloorDistribution(state), 0);
  assert.equal(validateState(state), true);
  separateFloorKeys(state.keys);
  assert.ok(state.keys.filter(key => key.status === 'floor').every(key => !inStationFootprint(key.x, key.z, .2)));
});

test('damaged keys are identified and must be discarded before completion', () => {
  const state = createInitialState();
  const broken = state.keys.find(key => key.broken);
  assert.equal(pickupKey(state, broken.id), true);
  assert.equal(putKeyInCabinet(state, broken.type), false);
  assert.equal(trashSelectedKey(state), true);
  assert.equal(broken.status, 'trashed');
  assert.equal(getProgress(state).trashed, 1);
  assert.equal(getProgress(state).processed, 1);
  assert.equal(state.metal, 1);
  assert.equal(validateState(state), true);
  assert.equal(trashSelectedKey(state), false);
});

test('the 1,000 keys include balanced layers of wax, mud, rust and breakage', () => {
  const keys = createInitialKeys();
  const counts = keys.reduce((totals, key) => {
    totals[keyCondition(key)]++;
    return totals;
  }, { clean: 0, mud: 0, rust: 0, both: 0, broken: 0, wax: 0 });
  assert.deepEqual(counts, { clean: 760, mud: 80, rust: 60, both: 10, broken: 40, wax: 50 });
  assert.equal(new Set([...MUD_ORDINALS, ...RUST_ORDINALS, ...BOTH_ORDINALS]).size, 16);
  assert.equal(STATIONS.length, 1);
  assert.deepEqual(STATIONS.map(station => station.z), [0]);
});

test('water and rust solution each hold four keys and release only after soaking', () => {
  const state = createInitialState();
  const id = bathId('center', 'mud');
  const muddy = state.keys.filter(key => key.mud && !key.wax).slice(0, BATH_CAPACITY + 1);
  const start = 1000;
  for (const key of muddy.slice(0, BATH_CAPACITY)) {
    assert.equal(pickupKey(state, key.id), true);
    assert.equal(startSoak(state, id, 'mud', start), true);
  }
  assert.equal(bathContents(state, id, start).space, 0);
  assert.equal(getProgress(state).soaking, 4);
  assert.equal(validateState(state), true);
  assert.equal(pickupKey(state, muddy[4].id), true);
  assert.equal(startSoak(state, id, 'mud', start), false);
  assert.equal(collectSoakedKey(state, id, start + SOAK_SECONDS.mud * 1000 - 1), null);
  const retrieved = collectSoakedKey(state, id, start + SOAK_SECONDS.mud * 1000);
  assert.equal(retrieved.id, muddy[0].id);
  assert.equal(retrieved.mud, false);
  assert.equal(retrieved.status, 'held');
  assert.equal(bathContents(state, id).keys.length, 3);
  assert.equal(state.held.length, 2);
  assert.equal(validateState(state), true);
});

test('mud-and-rust keys need both baths before they can be shelved', () => {
  const state = createInitialState();
  const both = state.keys.find(key => key.mud && key.rust && !key.wax);
  assert.equal(pickupKey(state, both.id), true);
  assert.equal(putKeyInCabinet(state, both.type), false);
  assert.equal(startSoak(state, bathId('far', 'mud'), 'mud', 1000), false);
  assert.equal(startSoak(state, bathId('center', 'mud'), 'mud', 1000), true);
  assert.equal(collectSoakedKey(state, bathId('center', 'mud'), 6000)?.id, both.id);
  assert.equal(keyCondition(both), 'rust');
  assert.equal(putKeyInCabinet(state, both.type), false);
  assert.equal(startSoak(state, bathId('center', 'rust'), 'rust', 6000), true);
  assert.equal(collectSoakedKey(state, bathId('center', 'rust'), 35999), null);
  assert.equal(collectSoakedKey(state, bathId('center', 'rust'), 36000)?.id, both.id);
  assert.equal(keyCondition(both), 'clean');
  assert.equal(putKeyInCabinet(state, both.type), true);
  assert.equal(validateState(state), true);
});

test('old baths migrate into the central station without losing soaking keys', () => {
  const state = createInitialState();
  const muddy = state.keys.filter(key => key.mud).slice(0, 7);
  for (const [index, key] of muddy.entries()) {
    key.status = 'bath';
    key.bathId = index === 0 ? bathId('center', 'mud') : bathId(index % 2 ? 'far' : 'near', 'mud');
    key.bathUntil = index * 1000 + 5000;
  }
  assert.equal(validateState(state), false);
  assert.equal(upgradeStationBaths(state, 10000), 6);
  const central = state.keys.filter(key => key.status === 'bath' && key.bathId === bathId('center', 'mud'));
  assert.equal(central.length, BATH_CAPACITY);
  assert.equal(central[0].id, muddy[0].id);
  const overflow = muddy.filter(key => key.status === 'floor');
  assert.equal(overflow.length, 3);
  assert.deepEqual(overflow.map(key => key.mud), [false, false, true]);
  assert.ok(overflow.every(key => !('bathUntil' in key) && !('bathId' in key)));
  assert.equal(validateState(state), true);
  assert.equal(upgradeStationBaths(state, 10000), 0);
});

test('upgrading a previous save keeps sorted keys clean and previously melted metal', () => {
  const state = createInitialState();
  const cleanAtStart = state.keys.find(key => key.mud);
  cleanAtStart.status = 'sorted';
  for (const key of state.keys) { delete key.mud; delete key.rust; }
  delete state.metal;
  const broken = state.keys.find(key => key.broken);
  broken.status = 'trashed';
  upgradeKeyConditions(state);
  assert.equal(cleanAtStart.mud, false);
  assert.equal(cleanAtStart.rust, false);
  assert.equal(state.metal, 1);
  assert.equal(validateState(state), true);
});

test('existing key saves acquire damage conditions without losing placements', () => {
  const state = createInitialState();
  const oldBroken = state.keys.find(key => key.broken);
  oldBroken.broken = undefined;
  oldBroken.status = 'sorted';
  for (const key of state.keys) delete key.broken;
  upgradeKeyConditions(state);
  assert.equal(oldBroken.broken, false);
  assert.equal(getProgress(state).required[oldBroken.type], 97);
  assert.equal(validateState(state), true);
});

test('scattered and thrown keys keep enough room not to intersect', () => {
  const state = createInitialState();
  assert.ok(separateFloorKeys(state.keys) > 100);
  const grid = new Map();
  for (const key of state.keys) {
    const x = Math.floor(key.x / KEY_CLEARANCE);
    const z = Math.floor(key.z / KEY_CLEARANCE);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const other of grid.get(`${x + dx},${z + dz}`) || []) {
        assert.ok(Math.hypot(other.x - key.x, other.z - key.z) >= KEY_CLEARANCE - 1e-6);
      }
    }
    const id = `${x},${z}`;
    if (!grid.has(id)) grid.set(id, []);
    grid.get(id).push(key);
  }
  const landing = findFreeFloorSpot(state.keys, state.keys[0].x, state.keys[0].z);
  assert.ok(state.keys.every(key => Math.hypot(key.x - landing.x, key.z - landing.z) >= KEY_CLEARANCE - 1e-6));
  assert.ok(state.keys.every(key => !inStationFootprint(key.x, key.z, .20)));
});

test('each cabinet has 96 individual cubbies, four within each main compartment', () => {
  assert.equal(CABINET_ROWS, 4);
  assert.equal(CABINET_COLUMNS, 6);
  assert.equal(CABINET_CAPACITY, 96);
  assert.equal(CABINET_COLUMN_WIDTH, .432);
  assert.equal(CABINET_ROW_HEIGHT, .621);
  assert.ok(Math.abs(CABINET_GRID_BOTTOM_Y - CABINET_BLANK_ROW_BOTTOM_Y - CABINET_ROW_HEIGHT) < 1e-9);
  assert.ok(Math.abs(CABINET_GRID_TOP_Y - CABINET_GRID_BOTTOM_Y - CABINET_ROWS * CABINET_ROW_HEIGHT) < 1e-9);
  assert.ok(CABINET_BACK_FRONT_Z < CABINET_SHELF_CENTER_Z + CABINET_SHELF_DEPTH / 2);
  assert.ok(Math.abs(CABINET_GROUND_OFFSET + .15 - .33 / 2 - (-.05)) < 1e-9);
  assert.equal(CABINET_SHELF_DEPTH, .57 / 2 * .85);
  const cells = Array.from({ length: CABINET_CAPACITY }, (_, index) => pegForSlot(index));
  assert.equal(new Set(cells.map(cell => `${cell.x.toFixed(3)}|${cell.y.toFixed(3)}`)).size, CABINET_CAPACITY);
  assert.ok(cells.every(cell => cell.x > -CABINET_GRID_HALF_WIDTH && cell.x < CABINET_GRID_HALF_WIDTH && cell.y > CABINET_GRID_BOTTOM_Y && cell.y < CABINET_GRID_TOP_Y));
  assert.ok(cells.every(cell => cell.z > CABINET_SHELF_CENTER_Z && cell.z < CABINET_OUTLINE.front));
  assert.equal(new Set(cells.map(cell => cell.x)).size, CABINET_COLUMNS * 2);
  assert.equal(new Set(cells.map(cell => cell.y)).size, CABINET_ROWS * 2);
  for (let i = 0; i < CABINET_CAPACITY; i += 4) {
    assert.ok(cells[i].y >= cells[i + 3].y);
  }
  assert.ok(Math.abs(CABINET_OUTLINE.width / 2 + CABINET_OUTLINE.thickness / 2 - (CABINET_GRID_HALF_WIDTH + .14 + .26 / 2)) < .015);
  assert.ok(CABINET_OUTLINE.top + CABINET_OUTLINE.thickness / 2 <= 4.77 + .24 / 2);
  assert.throws(() => pegForSlot(96), RangeError);
  const finalPose = cabinetKeyPose(12, .185);
  assert.deepEqual([finalPose.x, finalPose.y, finalPose.z],
    [cells[12].x, cells[12].y + .005, CABINET_BACK_FRONT_Z + .055]);
  assert.equal(finalPose.scale, .145 * (1.15 * 1.10));
  assert.deepEqual(new Set(getProgress(createInitialState()).required), new Set([96]));
});

test('keys rest just above both floor surfaces instead of hovering in the hall', () => {
  assert.ok(HALL_FLOOR_TOP < RUG_TOP);
  assert.equal(floorSurfaceY(0, 0), RUG_TOP);
  assert.equal(floorSurfaceY(10, 0), HALL_FLOOR_TOP);
  assert.equal(floorSurfaceY(0, 20), HALL_FLOOR_TOP);
  for (const [x, z] of [[0, 0], [10, 0], [0, 20], [-11, -20]]) {
    const gap = restingKeyY(x, z) - floorSurfaceY(x, z);
    assert.ok(gap > 0 && gap < .02);
  }
});

test('only a matching cabinet accepts the selected key', () => {
  const state = createInitialState();
  const key = state.keys[0];
  assert.equal(pickupKey(state, key.id), true);
  assert.equal(selectedKey(state)?.id, key.id);
  assert.equal(putKeyInCabinet(state, 1), false);
  assert.equal(state.held.length, 1);
  assert.equal(putKeyInCabinet(state, key.type), true);
  assert.equal(getProgress(state).done, 1);
  assert.equal(getProgress(state).floorCount, 999);
  assert.equal(state.held.length, 0);
  assert.equal(validateState(state), true);
});

test('inventory limit and dropping onto the floor', () => {
  const state = createInitialState();
  for (let i = 0; i < MAX_HELD; i++) assert.equal(pickupKey(state, state.keys[i].id), true);
  assert.equal(pickupKey(state, state.keys[MAX_HELD].id), false);
  const dropped = selectedKey(state);
  assert.equal(dropSelectedKey(state, 2, 4, 1.5), true);
  assert.equal(dropped.status, 'floor');
  assert.equal(dropped.x, 2);
  assert.equal(state.held.length, MAX_HELD - 1);
  assert.equal(validateState(state), true);
});

test('bad snapshots are discarded by validation', () => {
  const state = createInitialState();
  state.keys[0].status = 'held';
  assert.equal(validateState(state), false);
});

test('old 80-key progress is retained when upgrading the hall', () => {
  const legacy = createInitialState();
  legacy.version = 1;
  legacy.keys = legacy.keys.filter(key => Number(key.id.split('-')[1]) < 8);
  legacy.keys[0].status = 'sorted';
  legacy.keys[1].status = 'held';
  legacy.held = [legacy.keys[1].id];
  assert.equal(legacy.keys.length, 80);
  const migrated = migrateLegacyState(legacy);
  assert.equal(validateState(migrated), true);
  assert.equal(migrated.keys.length, 1000);
  assert.equal(migrated.keys[0].status, 'sorted');
  assert.equal(getProgress(migrated).floorCount, 998);
});

test('a thrown key follows gravity, loses speed on impact and settles exactly on the floor', () => {
  const start = { x: 0, y: 1.4, z: 0 };
  const end = { x: 3, y: .085, z: -2 };
  const flight = throwFlightTime(start, end);
  const bounceEnd = flight + THROW_BOUNCE_SECONDS;
  const stopped = bounceEnd + THROW_SLIDE_SECONDS;
  const pose = time => sampleThrow(start, end, time);
  assert.ok(throwFlightTime({ ...start, lift: -.65 }, end) < flight);
  assert.ok(throwFlightTime({ ...start, lift: 2.2 }, end) > flight);
  assert.ok(pose(.10).y > start.y);
  assert.equal(pose(0).settle, 0);
  assert.equal(pose(flight).settle, 1);
  assert.equal(pose(flight).y, end.y);
  const firstArc = pose(flight + THROW_FIRST_BOUNCE_SECONDS / 2);
  const secondArc = pose(flight + THROW_FIRST_BOUNCE_SECONDS + THROW_SECOND_BOUNCE_SECONDS / 2);
  assert.ok(firstArc.y > secondArc.y && secondArc.y > end.y);
  assert.ok(Math.abs(pose(flight + THROW_FIRST_BOUNCE_SECONDS).y - end.y) < 1e-9);
  assert.equal(pose(flight - .001).contact, false);
  assert.equal(pose(flight).contact, true);
  const dt = .001;
  const speedAt = t => (pose(t + dt).x - pose(t - dt).x) / (2 * dt);
  assert.ok(speedAt(flight - .04) > speedAt(flight + .04));
  assert.ok(speedAt(bounceEnd + .04) > speedAt(stopped - .04));
  let previous = pose(0);
  for (let t = .005; t < stopped; t += .005) {
    const current = pose(t);
    assert.ok(current.x >= previous.x && current.y >= end.y - 1e-9);
    previous = current;
  }
  assert.deepEqual(pose(stopped + .001), { ...end, settle: 1, contact: true, wobble: 0, spin: 0, landed: true });
});

test('wax blocks filing and bath soaking, then exposes the two original layers', () => {
  const state = createInitialState();
  const key = state.keys.find(key => key.wax && key.mud && key.rust);
  assert.equal(pickupKey(state, key.id), true);
  assert.equal(putKeyInCabinet(state, key.type), false);
  assert.equal(startSoak(state, bathId('center', 'mud'), 'mud'), false);
  assert.equal(meltSelectedWax(state), key);
  assert.equal(keyCondition(key), 'both');
  assert.equal(meltSelectedWax(state), null);
  upgradeKeyConditions(state);
  assert.equal(key.wax, false);
});

test('a purchased bundle packs four matching keys beside a full mixed inventory', () => {
  const state = createInitialState();
  state.metal = 14;
  assert.equal(buyBundle(state), false);
  state.metal++;
  assert.equal(buyBundle(state), true);
  const clean = type => state.keys.filter(key => key.type === type && keyCondition(key) === 'clean');
  const keys = clean(0).slice(0, 4);
  const others = [...clean(1).slice(0, 2), ...clean(2).slice(0, 2)];
  for (const key of [...keys.slice(0, 3), others[0]]) assert.equal(pickupKey(state, key.id), true);
  assert.equal(pickupKey(state, others[1].id), false);
  assert.equal(pickupKey(state, keys[3].id), true);
  assert.deepEqual(state.held, [others[0].id]);
  assert.deepEqual(state.activeBundle.ids, keys.map(key => key.id));
  assert.ok(keys.every(key => key.status === 'bundled'));
  for (const key of others.slice(1)) assert.equal(pickupKey(state, key.id), true);
  const carried = JSON.parse(JSON.stringify(state));
  assert.ok(validateState(carried));
  assert.equal(putBundleInCabinet(state, 0, [1, 2, 2, 7]), null);
  assert.equal(putBundleInCabinet(state, 1, [1, 2, 6, 7]), null);
  assert.equal(state.bundles, 1);
  assert.deepEqual(putBundleInCabinet(state, 0, [1, 2, 6, 7]), keys);
  assert.deepEqual(keys.map(key => key.cabinetSlot), [1, 2, 6, 7]);
  assert.deepEqual(state.held, others.map(key => key.id));
  assert.equal(state.activeBundle, null);
  assert.equal(state.bundles, 1);
  assert.equal(buyBundle(state), false);
  for (const key of [...others]) dropSelectedKey(state, key.x, key.z, 0);
  const next = clean(0).filter(key => key.status === 'floor').slice(0, 4);
  for (const item of next) assert.equal(pickupKey(state, item.id), true);
  assert.deepEqual(state.activeBundle.ids, next.map(key => key.id));
  assert.ok(validateState(state));
});

test('pre-bundle saves pack four matching keys on load without spending the purchase', () => {
  const state = createInitialState();
  const keys = state.keys.filter(key => key.type === 0 && keyCondition(key) === 'clean').slice(0, 4);
  for (const key of keys) pickupKey(state, key.id);
  state.bundles = 1;
  delete state.activeBundle;
  const loaded = loadArchiveState({getItem: key => key === STORAGE_KEY ? JSON.stringify(state) : null});
  assert.deepEqual(loaded.activeBundle.ids, keys.map(key => key.id));
  assert.deepEqual(loaded.held, []);
  assert.equal(loaded.bundles, 1);
});

test('a ring used under the old rules is restored from its recorded metal cost', () => {
  const state = createInitialState();
  for (const key of state.keys.filter(key => key.broken).slice(0, 17)) key.status = 'trashed';
  state.metal = 2;
  assert.equal(state.bundles, 0);
  upgradeKeyConditions(state);
  assert.equal(state.bundles, 1);
  assert.equal(state.metal, 2);
});
