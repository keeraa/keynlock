import { BATH_CAPACITY, SOAK_SECONDS, bathId, validBathId } from './station-layout.js';
import { CABINET_CAPACITY } from './cabinet-layout.js';
import { SAVE_REVISION } from './save-revisions.js';

// `id` is a stable legacy save slot. The displayed family is from the Forge.
export const KEY_TYPES = [
  { id: 'circle', name: 'Подвальный', hint: 'Круг · ртуть', metal: 0x839fa6, mark: 'I' },
  { id: 'triangle', name: 'Башенный', hint: 'Готическая арка · олово', metal: 0xb4b7aa, mark: 'II' },
  { id: 'square', name: 'Архивный', hint: 'Квадрат · сталь', metal: 0xa1acac, mark: 'III' },
  { id: 'diamond', name: 'Часовой', hint: 'Ромб · бирюзовая эмаль', metal: 0x489f9c, mark: 'IV' },
  { id: 'pentagon', name: 'Астролябия', hint: 'Зубчатый венец · латунь', metal: 0xce9b4c, mark: 'V' },
  { id: 'hexagon', name: 'Кузнечный', hint: 'Шестигранник · чернёное железо', metal: 0x515c60, mark: 'VI' },
  { id: 'star', name: 'Алхимический', hint: 'Звезда · медь', metal: 0xbc704d, mark: 'VII' },
  { id: 'clover', name: 'Садовый', hint: 'Клевер · серебро', metal: 0xd5d9d6, mark: 'VIII' },
  { id: 'oval', name: 'Дворцовый', hint: 'Вытянутый овал · позолота', metal: 0xe4b866, mark: 'IX' },
  { id: 'crown', name: 'Братства', hint: 'Двойное ушко · медь', metal: 0xbc704d, mark: 'X' },
];

export const KEYS_PER_TYPE = 100;
export const TOTAL_KEYS = KEY_TYPES.length * KEYS_PER_TYPE;
export const MAX_HELD = 4;
export const BUNDLE_COST = 15;
const WAX_ORDINALS = [19, 29, 46, 69, 93];
export const BROKEN_ORDINALS = [13, 38, 63, 88];
export const MUD_ORDINALS = [3, 15, 27, 39, 51, 65, 77, 89];
export const RUST_ORDINALS = [7, 23, 35, 49, 71, 95];
export const BOTH_ORDINALS = [19, 83];
export const STORAGE_KEY = 'keynlock-key-archive-prototype-v2';
export const LEGACY_STORAGE_KEY = 'keynlock-key-archive-prototype-v1';
export const FLOOR_DISTRIBUTION_VERSION = 2;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function createInitialKeys() {
  const random = seededRandom(260118);
  const keys = [];
  for (let type = 0; type < KEY_TYPES.length; type++) {
    for (let ordinal = 0; ordinal < KEYS_PER_TYPE; ordinal++) {
      // Every family is spread across the entire room, rather than a type-based heap.
      const x = (random() - .5) * 17.1;
      const z = (random() - .5) * 35.7;
      keys.push({
        id: `${type}-${ordinal}`, type, x, z,
        rotation: random() * Math.PI * 2,
        variation: Math.floor(random() * 3),
        layer: random() * .025,
        broken: BROKEN_ORDINALS.includes(ordinal),
        mud: MUD_ORDINALS.includes(ordinal) || BOTH_ORDINALS.includes(ordinal),
        rust: RUST_ORDINALS.includes(ordinal) || BOTH_ORDINALS.includes(ordinal),
        wax: WAX_ORDINALS.includes(ordinal),
        status: 'floor',
      });
    }
  }
  return keys;
}

export function createInitialState() {
  return { version: 2, revision: SAVE_REVISION, keys: createInitialKeys(), held: [], selected: 0, metal: 0, bundles: 0,
    activeBundle: null, floorDistributionVersion: FLOOR_DISTRIBUTION_VERSION };
}

// Existing saves previously grouped each family in a separate heap. Redistribute
// only the uncollected keys once, preserving everything already processed.
export function upgradeFloorDistribution(state) {
  if (state.floorDistributionVersion === FLOOR_DISTRIBUTION_VERSION) return 0;
  const floor = state.keys.filter(key => key.status === 'floor');
  const random = seededRandom(0x6d781a4);
  const positions = floor.map(() => ({ x: (random() - .5) * 17.1,
    z: (random() - .5) * 35.7, rotation: random() * Math.PI * 2 }));
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  floor.forEach((key, index) => Object.assign(key, positions[index]));
  state.floorDistributionVersion = FLOOR_DISTRIBUTION_VERSION;
  return floor.length;
}

// Existing saves were created before damaged keys were introduced.
// Keep already sorted or held keys intact so upgrades do not undo progress.
export function upgradeKeyConditions(state) {
  for (const key of state.keys) {
    const ordinal = Number(key.id.split('-')[1]);
    if (typeof key.broken !== 'boolean') {
      key.broken = key.status === 'floor' && BROKEN_ORDINALS.includes(ordinal);
    }
    if (typeof key.mud !== 'boolean') key.mud = key.status !== 'sorted' && !key.broken &&
      (MUD_ORDINALS.includes(ordinal) || BOTH_ORDINALS.includes(ordinal));
    if (typeof key.wax !== 'boolean') key.wax = key.status === 'floor' && !key.broken && WAX_ORDINALS.includes(ordinal);
    if (typeof key.rust !== 'boolean') key.rust = key.status !== 'sorted' && !key.broken &&
      (RUST_ORDINALS.includes(ordinal) || BOTH_ORDINALS.includes(ordinal));
  }
  if (!Number.isInteger(state.metal) || state.metal < 0) {
    state.metal = state.keys.filter(key => key.status === 'trashed').length;
  }
  // Previously every use deducted a purchased ring. Recover ownership from
  // the record of smelted keys and metal spent on rings.
  if (!state.bundles && state.keys.filter(key => key.status === 'trashed').length - state.metal >= BUNDLE_COST)
    state.bundles = 1;
  return state;
}

// Older saves only recorded that a key was sorted. Assign those keys to their
// original top-to-bottom cells once, without moving already positioned keys.
export function upgradeCabinetSlots(state) {
  for (let type = 0; type < KEY_TYPES.length; type++) {
    const used = new Set();
    const sorted = state.keys.filter(key => key.type === type && key.status === 'sorted');
    for (const key of sorted) {
      if (Number.isInteger(key.cabinetSlot) && key.cabinetSlot >= 0 &&
          key.cabinetSlot < CABINET_CAPACITY && !used.has(key.cabinetSlot)) {
        used.add(key.cabinetSlot);
      } else delete key.cabinetSlot;
    }
    for (const key of sorted) {
      if (key.cabinetSlot !== undefined) continue;
      const slot = Array.from({ length: CABINET_CAPACITY }, (_, i) => i)
        .find(index => !used.has(index));
      if (slot === undefined) throw new RangeError('Cabinet has no unoccupied cell');
      key.cabinetSlot = slot;
      used.add(slot);
    }
  }
  return state;
}

const BATH_SLOTS = Array.from({ length: BATH_CAPACITY }, (_, index) => index);

function reserveBathSlots(keys) {
  const occupied = new Set();
  const unassigned = [];
  for (const key of keys) {
    if (BATH_SLOTS.includes(key.bathSlot) && !occupied.has(key.bathSlot)) {
      occupied.add(key.bathSlot);
    } else {
      unassigned.push(key);
    }
  }
  for (const key of unassigned) {
    key.bathSlot = BATH_SLOTS.find(slot => !occupied.has(slot));
    occupied.add(key.bathSlot);
  }
  return occupied;
}

// Earlier builds had two additional workstations. Preserve soaking keys when
// those stations disappear, keeping the original completion times whenever a
// central bath has room. Overflow returns to the floor; finished keys are clean.
export function upgradeStationBaths(state, now = Date.now()) {
  if (state?.version !== 2 || !Array.isArray(state.keys)) return 0;
  let migrated = 0;
  for (const kind of ['mud', 'rust']) {
    const centralId = bathId('center', kind);
    const occupied = state.keys.filter(key => key.status === 'bath' && key.bathId === centralId).length;
    const free = Math.max(0, BATH_CAPACITY - occupied);
    const removedBathIds = [bathId('far', kind), bathId('near', kind)];
    const waiting = state.keys.filter(key => key.status === 'bath' && removedBathIds.includes(key.bathId))
      .sort((a, b) => a.bathUntil - b.bathUntil);
    waiting.forEach((key, index) => {
      migrated++;
      if (index < free) {
        key.bathId = centralId;
      } else {
        if (now >= key.bathUntil) key[kind] = false;
        key.status = 'floor';
        delete key.bathId;
        delete key.bathSlot;
        delete key.bathUntil;
      }
    });
    reserveBathSlots(state.keys.filter(key => key.status === 'bath' && key.bathId === centralId));
  }
  return migrated;
}

export function validateState(candidate) {
  if (!candidate || candidate.version !== 2 || !Array.isArray(candidate.keys) ||
      candidate.keys.length !== TOTAL_KEYS || !Array.isArray(candidate.held) ||
      candidate.held.length > MAX_HELD) return false;
  const bundle = candidate.activeBundle;
  if (bundle != null && (!Array.isArray(bundle.ids) || bundle.ids.length !== MAX_HELD ||
      new Set(bundle.ids).size !== MAX_HELD || !Number.isInteger(bundle.type) ||
      bundle.type < 0 || bundle.type >= KEY_TYPES.length || !(candidate.bundles > 0))) return false;
  const ids = new Set();
  const heldIDs = new Set(candidate.held);
  const bundledIDs = new Set(bundle?.ids);
  for (const key of candidate.keys) {
    if (!Number.isInteger(key.type) || key.type < 0 || key.type >= KEY_TYPES.length ||
        !Number.isFinite(key.x) || !Number.isFinite(key.z) ||
        !Number.isFinite(key.rotation) || !['floor', 'held', 'bundled', 'sorted', 'trashed', 'smelting', 'bath'].includes(key.status) ||
        (key.broken !== undefined && typeof key.broken !== 'boolean') ||
        (key.mud !== undefined && typeof key.mud !== 'boolean') ||
        (key.wax !== undefined && (typeof key.wax !== 'boolean' || (key.wax && key.status === 'sorted'))) ||
        (key.rust !== undefined && typeof key.rust !== 'boolean') ||
        (key.status === 'trashed' && !key.broken) ||
        (key.status === 'smelting' && (!key.broken || !Number.isFinite(key.smeltUntil))) ||
        (key.status === 'bath' && (key.broken || !validBathId(key.bathId) ||
          !Number.isFinite(key.bathUntil))) ||
        (key.cabinetSlot !== undefined && (!Number.isInteger(key.cabinetSlot) ||
          key.cabinetSlot < 0 || key.cabinetSlot >= CABINET_CAPACITY)) ||
        ids.has(key.id)) return false;
    ids.add(key.id);
    if ((key.status === 'held') !== heldIDs.has(key.id) ||
        (key.status === 'bundled') !== bundledIDs.has(key.id)) return false;
    if (bundledIDs.has(key.id) && (key.type !== bundle.type || keyCondition(key) !== 'clean')) return false;
  }
  if (candidate.bundles !== undefined && (!Number.isInteger(candidate.bundles) || candidate.bundles < 0 || candidate.bundles > 2)) return false;
  if (candidate.metal !== undefined && (!Number.isInteger(candidate.metal) || candidate.metal < 0)) return false;
  if (candidate.keys.filter(key => key.status === 'bath').some(key =>
    candidate.keys.filter(other => other.status === 'bath' && other.bathId === key.bathId).length > BATH_CAPACITY)) return false;
  return [...heldIDs, ...bundledIDs].every(id => ids.has(id));
}

// Preserve the player's progress when upgrading the first 80-key prototype.
export function migrateLegacyState(candidate) {
  if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.keys) ||
      candidate.keys.length !== 80 || !Array.isArray(candidate.held)) return null;
  const next = createInitialState();
  const previous = new Map(candidate.keys.map(key => [key.id, key]));
  for (const key of next.keys) {
    const saved = previous.get(key.id);
    if (!saved) continue;
    key.x = saved.x;
    key.z = saved.z;
    key.rotation = saved.rotation;
    key.status = saved.status;
    if (key.status !== 'floor') key.wax = false;
  }
  next.held = [...candidate.held];
  next.selected = Math.min(Math.max(0, candidate.selected || 0), Math.max(0, next.held.length - 1));
  next.floorDistributionVersion = 1;
  return validateState(next) ? next : null;
}

function matchingHeldKeys(state, type) {
  return state.held.map(id => state.keys.find(key => key.id === id))
    .filter(key => key?.type === type && keyCondition(key) === 'clean');
}

function canPackWith(state, key) {
  return Boolean(state.bundles && !state.activeBundle && key && keyCondition(key) === 'clean' &&
    matchingHeldKeys(state, key.type).length === MAX_HELD - 1);
}

export function canPickupKey(state, key) {
  return key?.status === 'floor' && (state.held.length < MAX_HELD || canPackWith(state, key));
}

export function packHeldBundle(state, type = selectedKey(state)?.type) {
  if (!state.bundles || state.activeBundle || type === undefined || state.held.length < MAX_HELD) return false;
  const keys = matchingHeldKeys(state, type);
  if (keys.length !== MAX_HELD) return false;
  const ids = keys.map(key => key.id);
  for (const key of keys) key.status = 'bundled';
  const selected = state.held[state.selected];
  state.held = state.held.filter(id => !ids.includes(id));
  state.selected = Math.max(0, state.held.indexOf(selected));
  state.activeBundle = { type, ids };
  return true;
}

export function pickupKey(state, keyId) {
  const key = state.keys.find(item => item.id === keyId);
  if (!canPickupKey(state, key)) return false;
  key.status = 'held';
  state.held.push(keyId);
  state.selected = state.held.length - 1;
  packHeldBundle(state, key.type);
  return true;
}

export function selectedKey(state) {
  return state.keys.find(key => key.id === state.held[state.selected]) || null;
}

export function cabinetSlotKey(state, cabinetType, slotIndex) {
  return state.keys.find(key => key.type === cabinetType && key.status === 'sorted' &&
    key.cabinetSlot === slotIndex) || null;
}

export function putKeyInCabinet(state, cabinetType, slotIndex = null) {
  const key = selectedKey(state);
  if (!key || key.broken || key.wax || key.mud || key.rust || key.type !== cabinetType) return false;
  const taken = new Set(state.keys.filter(item => item.type === cabinetType && item.status === 'sorted')
    .map(item => item.cabinetSlot));
  const slot = slotIndex === null ? Array.from({ length: CABINET_CAPACITY }, (_, i) => i)
    .find(index => !taken.has(index)) : slotIndex;
  if (!Number.isInteger(slot) || slot < 0 || slot >= CABINET_CAPACITY || taken.has(slot)) return false;
  key.status = 'sorted';
  key.cabinetSlot = slot;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

export function buyBundle(state) {
  if ((state.metal ?? 0) < BUNDLE_COST || state.bundles) return false;
  state.metal -= BUNDLE_COST;
  state.bundles = 1;
  packHeldBundle(state);
  return true;
}

export function heldBundle(state, type) {
  const bundle = state.activeBundle;
  if (!bundle || bundle.type !== type) return null;
  return bundle.ids.map(id => state.keys.find(key => key.id === id));
}

export function putBundleInCabinet(state, type, slots) {
  const keys = heldBundle(state, type);
  if (!keys || slots.length !== MAX_HELD || new Set(slots).size !== MAX_HELD ||
      slots.some(slot => !Number.isInteger(slot) || slot < 0 || slot >= CABINET_CAPACITY ||
        cabinetSlotKey(state, type, slot))) return null;
  keys.forEach((key, i) => {
    key.status = 'sorted';
    key.cabinetSlot = slots[i];
  });
  state.activeBundle = null;
  packHeldBundle(state);
  return keys;
}

export function meltSelectedWax(state) {
  const key = selectedKey(state);
  if (!key?.wax || key.broken) return null;
  key.wax = false;
  packHeldBundle(state, key.type);
  return key;
}

export function takeKeyFromCabinet(state, cabinetType, slotIndex) {
  if (state.held.length >= MAX_HELD) return null;
  const key = cabinetSlotKey(state, cabinetType, slotIndex);
  if (!key) return null;
  key.status = 'held';
  delete key.cabinetSlot;
  state.held.push(key.id);
  state.selected = state.held.length - 1;
  packHeldBundle(state, key.type);
  return key;
}

// Smelting takes time. Broken keys queue in the forge one after another;
// each becomes one unit of metal when its turn is over.
export const SMELT_SECONDS = 30;

export function trashSelectedKey(state, now = Date.now()) {
  const key = selectedKey(state);
  if (!key?.broken) return false;
  const queueEnd = state.keys.reduce((latest, item) =>
    item.status === 'smelting' ? Math.max(latest, item.smeltUntil) : latest, now);
  key.status = 'smelting';
  key.smeltUntil = queueEnd + SMELT_SECONDS * 1000;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

// Finished smelts turn into metal (also after reopening a save). Returns how many.
export function settleSmelting(state, now = Date.now()) {
  let settled = 0;
  for (const key of state.keys) {
    if (key.status !== 'smelting' || key.smeltUntil > now) continue;
    key.status = 'trashed';
    delete key.smeltUntil;
    state.metal = (state.metal || 0) + 1;
    settled++;
  }
  return settled;
}

// The key melting right now, its progress and how many wait behind it.
export function smeltingState(state, now = Date.now()) {
  const queue = state.keys.filter(key => key.status === 'smelting' && key.smeltUntil > now)
    .sort((a, b) => a.smeltUntil - b.smeltUntil);
  if (!queue.length) return null;
  const current = queue[0];
  const duration = SMELT_SECONDS * 1000;
  return { key: current, waiting: queue.length - 1,
    progress: Math.max(0, Math.min(1, 1 - (current.smeltUntil - now) / duration)),
    secondsLeft: Math.ceil((current.smeltUntil - now) / 1000),
    totalSecondsLeft: Math.ceil((queue.at(-1).smeltUntil - now) / 1000) };
}

export function keyCondition(key) {
  if (key.broken) return 'broken';
  if (key.wax) return 'wax';
  if (key.mud && key.rust) return 'both';
  if (key.mud) return 'mud';
  if (key.rust) return 'rust';
  return 'clean';
}

export function bathContents(state, id, now = Date.now()) {
  return describeBathContents(state.keys.filter(key => key.status === 'bath' && key.bathId === id), now);
}

export function describeBathContents(keys, now) {
  return { keys, ready: keys.filter(key => now >= key.bathUntil),
    pending: keys.filter(key => now < key.bathUntil), space: BATH_CAPACITY - keys.length };
}

export function startSoak(state, id, kind, now = Date.now()) {
  const key = selectedKey(state);
  if (!validBathId(id, kind) || !key || key.broken || key.wax || !key[kind]) return false;
  const { keys, space } = bathContents(state, id, now);
  if (space <= 0) return false;
  const occupied = reserveBathSlots(keys);
  key.status = 'bath';
  key.bathId = id;
  key.bathSlot = BATH_SLOTS.find(slot => !occupied.has(slot));
  key.bathUntil = now + SOAK_SECONDS[kind] * 1000;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

// keyId: the key the player is looking at; otherwise the first ready one.
export function collectSoakedKey(state, id, now = Date.now(), keyId = null) {
  if (state.held.length >= MAX_HELD) return null;
  const ready = bathContents(state, id, now).ready;
  const key = keyId ? ready.find(item => item.id === keyId) : ready[0];
  if (!key) return null;
  const kind = id.endsWith('-mud') ? 'mud' : 'rust';
  key[kind] = false;
  key.status = 'held';
  delete key.bathId;
  delete key.bathSlot;
  delete key.bathUntil;
  state.held.push(key.id);
  state.selected = state.held.length - 1;
  packHeldBundle(state, key.type);
  return key;
}

export function dropSelectedKey(state, x, z, rotation) {
  const key = selectedKey(state);
  if (!key) return false;
  key.status = 'floor';
  key.x = x;
  key.z = z;
  key.rotation = rotation;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

export function getProgress(state) {
  const sorted = Array(KEY_TYPES.length).fill(0);
  const required = Array(KEY_TYPES.length).fill(0);
  let floorCount = 0;
  let trashed = 0;
  let broken = 0;
  let soaking = 0;
  let smelting = 0;
  for (const key of state.keys) {
    if (key.status === 'sorted') sorted[key.type]++;
    if (!key.broken) required[key.type]++;
    else broken++;
    if (key.status === 'floor') floorCount++;
    if (key.status === 'trashed') trashed++;
    if (key.status === 'bath') soaking++;
    if (key.status === 'smelting') smelting++;
  }
  return {
    sorted, required, trashed, broken,
    done: sorted.reduce((a, b) => a + b, 0),
    processed: sorted.reduce((a, b) => a + b, trashed),
    completedCabinets: sorted.filter((count, type) => count === required[type]).length,
    floorCount, soaking, smelting,
  };
}
