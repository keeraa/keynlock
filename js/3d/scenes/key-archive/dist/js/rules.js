import { BATH_CAPACITY, SOAK_SECONDS, validBathId } from './station-layout.js';

export const KEY_TYPES = [
  { id: 'circle', name: 'Кольцо', hint: 'Круглая головка', metal: 0xc7a66a, mark: 'I' },
  { id: 'triangle', name: 'Треугольник', hint: 'Три острых угла', metal: 0xb9aa89, mark: 'II' },
  { id: 'square', name: 'Квадрат', hint: 'Четыре прямые стороны', metal: 0xb88e56, mark: 'III' },
  { id: 'diamond', name: 'Ромб', hint: 'Косая квадратная рамка', metal: 0xd2ab6e, mark: 'IV' },
  { id: 'pentagon', name: 'Пятиугольник', hint: 'Пять граней', metal: 0xa49e96, mark: 'V' },
  { id: 'hexagon', name: 'Шестигранник', hint: 'Шесть граней', metal: 0xc8a671, mark: 'VI' },
  { id: 'star', name: 'Звезда', hint: 'Пять лучей', metal: 0xa9a0a0, mark: 'VII' },
  { id: 'clover', name: 'Клевер', hint: 'Четыре лепестка', metal: 0xcbb482, mark: 'VIII' },
  { id: 'oval', name: 'Овал', hint: 'Вытянутое кольцо', metal: 0xa58a66, mark: 'IX' },
  { id: 'crown', name: 'Корона', hint: 'Три зубца наверху', metal: 0xd1b37a, mark: 'X' },
];

export const KEYS_PER_TYPE = 100;
export const TOTAL_KEYS = KEY_TYPES.length * KEYS_PER_TYPE;
export const MAX_HELD = 4;
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
        status: 'floor',
      });
    }
  }
  return keys;
}

export function createInitialState() {
  return { version: 2, keys: createInitialKeys(), held: [], selected: 0, metal: 0,
    floorDistributionVersion: FLOOR_DISTRIBUTION_VERSION };
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
    if (typeof key.rust !== 'boolean') key.rust = key.status !== 'sorted' && !key.broken &&
      (RUST_ORDINALS.includes(ordinal) || BOTH_ORDINALS.includes(ordinal));
  }
  if (!Number.isInteger(state.metal) || state.metal < 0) {
    state.metal = state.keys.filter(key => key.status === 'trashed').length;
  }
  return state;
}

export function validateState(candidate) {
  if (!candidate || candidate.version !== 2 || !Array.isArray(candidate.keys) ||
      candidate.keys.length !== TOTAL_KEYS || !Array.isArray(candidate.held) ||
      candidate.held.length > MAX_HELD) return false;
  const ids = new Set();
  const heldIDs = new Set(candidate.held);
  for (const key of candidate.keys) {
    if (!Number.isInteger(key.type) || key.type < 0 || key.type >= KEY_TYPES.length ||
        !Number.isFinite(key.x) || !Number.isFinite(key.z) ||
        !Number.isFinite(key.rotation) || !['floor', 'held', 'sorted', 'trashed', 'bath'].includes(key.status) ||
        (key.broken !== undefined && typeof key.broken !== 'boolean') ||
        (key.mud !== undefined && typeof key.mud !== 'boolean') ||
        (key.rust !== undefined && typeof key.rust !== 'boolean') ||
        (key.status === 'trashed' && !key.broken) ||
        (key.status === 'bath' && (key.broken || !validBathId(key.bathId) ||
          !Number.isFinite(key.bathUntil))) ||
        ids.has(key.id)) return false;
    ids.add(key.id);
    if ((key.status === 'held') !== heldIDs.has(key.id)) return false;
  }
  if (candidate.metal !== undefined && (!Number.isInteger(candidate.metal) || candidate.metal < 0)) return false;
  if (candidate.keys.filter(key => key.status === 'bath').some(key =>
    candidate.keys.filter(other => other.status === 'bath' && other.bathId === key.bathId).length > BATH_CAPACITY)) return false;
  return candidate.held.every(id => ids.has(id));
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
  }
  next.held = [...candidate.held];
  next.selected = Math.min(Math.max(0, candidate.selected || 0), Math.max(0, next.held.length - 1));
  next.floorDistributionVersion = 1;
  return validateState(next) ? next : null;
}

export function pickupKey(state, keyId) {
  const key = state.keys.find(item => item.id === keyId);
  if (!key || key.status !== 'floor' || state.held.length >= MAX_HELD) return false;
  key.status = 'held';
  state.held.push(keyId);
  state.selected = state.held.length - 1;
  return true;
}

export function selectedKey(state) {
  return state.keys.find(key => key.id === state.held[state.selected]) || null;
}

export function putKeyInCabinet(state, cabinetType) {
  const key = selectedKey(state);
  if (!key || key.broken || key.mud || key.rust || key.type !== cabinetType) return false;
  key.status = 'sorted';
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

export function trashSelectedKey(state) {
  const key = selectedKey(state);
  if (!key?.broken) return false;
  key.status = 'trashed';
  state.metal = (state.metal || 0) + 1;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

export function keyCondition(key) {
  if (key.broken) return 'broken';
  if (key.mud && key.rust) return 'both';
  if (key.mud) return 'mud';
  if (key.rust) return 'rust';
  return 'clean';
}

export function bathContents(state, id, now = Date.now()) {
  const keys = state.keys.filter(key => key.status === 'bath' && key.bathId === id);
  return { keys, ready: keys.filter(key => now >= key.bathUntil),
    pending: keys.filter(key => now < key.bathUntil), space: BATH_CAPACITY - keys.length };
}

export function startSoak(state, id, kind, now = Date.now()) {
  const key = selectedKey(state);
  if (!validBathId(id, kind) || !key || key.broken || !key[kind] ||
    bathContents(state, id, now).space <= 0) return false;
  key.status = 'bath';
  key.bathId = id;
  key.bathUntil = now + SOAK_SECONDS[kind] * 1000;
  state.held.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.held.length - 1));
  return true;
}

export function collectSoakedKey(state, id, now = Date.now()) {
  if (state.held.length >= MAX_HELD) return null;
  const key = bathContents(state, id, now).ready[0];
  if (!key) return null;
  const kind = id.endsWith('-mud') ? 'mud' : 'rust';
  key[kind] = false;
  key.status = 'held';
  delete key.bathId;
  delete key.bathUntil;
  state.held.push(key.id);
  state.selected = state.held.length - 1;
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
  for (const key of state.keys) {
    if (key.status === 'sorted') sorted[key.type]++;
    if (!key.broken) required[key.type]++;
    else broken++;
    if (key.status === 'floor') floorCount++;
    if (key.status === 'trashed') trashed++;
    if (key.status === 'bath') soaking++;
  }
  return {
    sorted, required, trashed, broken,
    done: sorted.reduce((a, b) => a + b, 0),
    processed: sorted.reduce((a, b) => a + b, trashed),
    completedCabinets: sorted.filter((count, type) => count === required[type]).length,
    floorCount, soaking,
  };
}
