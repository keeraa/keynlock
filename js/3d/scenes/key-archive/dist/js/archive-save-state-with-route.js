import {
  STORAGE_KEY, LEGACY_STORAGE_KEY, createInitialState,
  validateState, migrateLegacyState, upgradeKeyConditions, upgradeFloorDistribution,
  upgradeStationBaths, upgradeCabinetSlots, packHeldBundle,
} from './rules.js?v=single-source';
import { prepareFirstRoute } from './archive-first-route-guide.js?v=key-ring';
import { separateFloorKeys } from './key-spacing.js?v=18';
import { VISUAL_STORAGE_KEY, normalizeVisualSettings } from './visual-settings.js?v=clear-day';

export const BACKUP_STORAGE_KEY = `${STORAGE_KEY}-backup`;

function readArchiveSnapshot(raw, migrate = value => value) {
  if (raw === null) return null;
  try {
    const snapshot = migrate(JSON.parse(raw));
    upgradeStationBaths(snapshot, Number.isFinite(snapshot?.stationTime) ? snapshot.stationTime : undefined);
    if (!validateState(snapshot)) return null;
    upgradeKeyConditions(snapshot);
    upgradeCabinetSlots(snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

function prepareArchive(state) {
  upgradeFloorDistribution(state);
  packHeldBundle(state);
  const starter = prepareFirstRoute(state);
  separateFloorKeys(starter ? [starter, ...state.keys.filter(key => key !== starter)] : state.keys);
  return state;
}

export function openArchiveSave(storage) {
  let primary = null;
  let backup = null;
  let legacy = null;
  let readable = true;
  try {
    primary = storage.getItem(STORAGE_KEY);
    backup = storage.getItem(BACKUP_STORAGE_KEY);
  } catch {
    readable = false;
  }
  const current = readArchiveSnapshot(primary);
  const reserve = current ? null : readArchiveSnapshot(backup);
  if (!current && !reserve && readable) {
    try { legacy = storage.getItem(LEGACY_STORAGE_KEY); }
    catch { readable = false; }
  }
  const migrated = current || reserve ? null : readArchiveSnapshot(legacy, migrateLegacyState);
  const found = current || reserve || migrated;
  const blocked = !readable ? 'unavailable' :
    !found && [primary, backup, legacy].some(value => value !== null) ? 'damaged' : null;
  const recovered = Boolean(!current && (reserve || (migrated && primary !== null)));
  const state = prepareArchive(found || createInitialState());

  function save() {
    if (blocked) return blocked;
    try {
      // An older tab must not silently overwrite changes observed from another tab.
      if (storage.getItem(STORAGE_KEY) !== primary || storage.getItem(BACKUP_STORAGE_KEY) !== backup)
        return 'conflict';
      const snapshot = JSON.stringify(state);
      if (snapshot !== primary) {
        storage.setItem(STORAGE_KEY, snapshot);
        primary = snapshot;
      }
      // The primary is now committed. Never rotate a known-good backup before this point.
      if (snapshot !== backup) {
        try {
          if (storage.getItem(STORAGE_KEY) !== snapshot || storage.getItem(BACKUP_STORAGE_KEY) !== backup)
            return 'conflict';
          storage.setItem(BACKUP_STORAGE_KEY, snapshot);
          backup = snapshot;
        } catch {
          return 'backup-error';
        }
      }
      return 'saved';
    } catch {
      return 'write-error';
    }
  }

  return { state, recovered, save };
}

export function loadArchiveState(storage) {
  return openArchiveSave(storage).state;
}

export function clearArchiveState(storage) {
  // A partial reset cannot revive an older copy after the primary is removed.
  storage.removeItem(LEGACY_STORAGE_KEY);
  storage.removeItem(BACKUP_STORAGE_KEY);
  storage.removeItem(STORAGE_KEY);
}

export function loadVisualSettings(storage) {
  try { return normalizeVisualSettings(JSON.parse(storage.getItem(VISUAL_STORAGE_KEY) || 'null')); }
  catch { return normalizeVisualSettings(null); }
}

export function saveVisualSettings(storage, values) {
  try { storage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(values)); } catch { /* optional storage */ }
}
