import { HOUSE_DEFAULTS, createHouseBlueprint, normalizeHouseConfig } from '../house-config.js';

const STORAGE_KEY = 'keynlock.house.builder.v1';

export function loadHouseEditorConfig(storage = localStorage) {
  let saved = {};
  try { saved = JSON.parse(storage.getItem(STORAGE_KEY) || '{}')?.params || {}; } catch {}
  return normalizeHouseConfig({...HOUSE_DEFAULTS, ...saved});
}

export function saveHouseEditorConfig(config, storage = localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(createHouseBlueprint(config))); } catch {}
}

export function downloadHouseBlueprint(config) {
  const file = new Blob([JSON.stringify(createHouseBlueprint(config), null, 2) + '\n'], {type:'application/json'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'keynlock-house-001.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
