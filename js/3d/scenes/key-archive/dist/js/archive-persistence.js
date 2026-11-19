import {
  STORAGE_KEY, LEGACY_STORAGE_KEY, createInitialState,
  validateState, migrateLegacyState, upgradeKeyConditions, upgradeFloorDistribution,
  upgradeStationBaths, upgradeCabinetSlots,
} from './rules.js?v=24';
import { separateFloorKeys } from './key-spacing.js?v=18';
import { VISUAL_STORAGE_KEY, normalizeVisualSettings } from './visual-settings.js?v=23';

export function loadArchiveState(storage) {
  let state;
  try {
    const snapshot = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const previous = JSON.parse(storage.getItem(LEGACY_STORAGE_KEY) || 'null');
    upgradeStationBaths(snapshot);
    state = validateState(snapshot) ? snapshot : migrateLegacyState(previous) || createInitialState();
  } catch { state = createInitialState(); }
  upgradeKeyConditions(state);
  upgradeCabinetSlots(state);
  upgradeFloorDistribution(state);
  separateFloorKeys(state.keys);
  return state;
}

export function loadVisualSettings(storage) {
  try { return normalizeVisualSettings(JSON.parse(storage.getItem(VISUAL_STORAGE_KEY) || 'null')); }
  catch { return normalizeVisualSettings(null); }
}

export function saveArchiveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* optional storage */ }
}

export function saveVisualSettings(storage, values) {
  try { storage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(values)); } catch { /* optional storage */ }
}
